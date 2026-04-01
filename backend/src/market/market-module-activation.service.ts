import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppConfigService } from '../app-config/app-config.service';
import {
  buildDefaultModulePrices,
  MARKET_MODULE_KEYS,
  type MarketModuleKey,
  type MarketPolicyConfig,
} from '../app-config/market-policy.defaults';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../types/enums';
import { ModulePeriodActivation } from './entities/module-period-activation.entity';
import { MarketModuleUsageService } from './market-module-usage.service';

function isMarketBillingExempt(role: UserRole): boolean {
  return role === UserRole.superadmin || role === UserRole.moderator;
}

function utcMonthLabel(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function utcYearLabel(d = new Date()): string {
  return String(d.getUTCFullYear());
}

function resolveBillingAccount(user: User): 'user' | 'school' {
  if (user.role === UserRole.school_admin && user.school_id) return 'school';
  return 'user';
}

function pairCost(jeton: unknown, ekders: unknown): { jeton: number; ekders: number } {
  const j = Number(jeton) || 0;
  const e = Number(ekders) || 0;
  return { jeton: j, ekders: e };
}

function hasTariffCost(p: { jeton: number; ekders: number }): boolean {
  return p.jeton > 0 || p.ekders > 0;
}

@Injectable()
export class MarketModuleActivationService {
  constructor(
    @InjectRepository(ModulePeriodActivation)
    private readonly repo: Repository<ModulePeriodActivation>,
    private readonly appConfig: AppConfigService,
    private readonly usage: MarketModuleUsageService,
  ) {}

  private getModuleRow(policy: MarketPolicyConfig, moduleKey: MarketModuleKey) {
    return policy.module_prices?.[moduleKey] ?? buildDefaultModulePrices()[moduleKey];
  }

  /** Aylık ve yıllık tarifede jeton/ek ders ikisi de 0 ise etkinleştirme gerekmez. */
  isModuleFreeFromPolicy(policy: MarketPolicyConfig, moduleKey: MarketModuleKey, billing: 'user' | 'school'): boolean {
    const row = this.getModuleRow(policy, moduleKey);
    const scope = billing === 'school' ? row.school : row.teacher;
    const m = pairCost(scope.monthly.jeton, scope.monthly.ekders);
    const y = pairCost(scope.yearly.jeton, scope.yearly.ekders);
    return !hasTariffCost(m) && !hasTariffCost(y);
  }

  /** Aylık ve yıllık tarifede jeton/ek ders ikisi de 0 ise etkinleştirme gerekmez. */
  async isModuleFreeForBilling(user: User, moduleKey: MarketModuleKey, billing: 'user' | 'school'): Promise<boolean> {
    const policy = await this.appConfig.getMarketPolicyConfig();
    return this.isModuleFreeFromPolicy(policy, moduleKey, billing);
  }

  /**
   * Web arayüzü: hangi modül için ücretli etkinleştirme eksik (tüm alt sekmelerde tek kontrol).
   */
  async getActivationStatus(user: User): Promise<{
    billing_account: 'user' | 'school';
    modules: Record<string, { free: boolean; active: boolean }>;
  }> {
    if (isMarketBillingExempt(user.role as UserRole)) {
      const modules = Object.fromEntries(
        MARKET_MODULE_KEYS.map((k) => [k, { free: true, active: true }]),
      ) as Record<string, { free: boolean; active: boolean }>;
      return { billing_account: 'user', modules };
    }
    const billing = resolveBillingAccount(user);
    const policy = await this.appConfig.getMarketPolicyConfig();
    const modules: Record<string, { free: boolean; active: boolean }> = {};
    await Promise.all(
      MARKET_MODULE_KEYS.map(async (k) => {
        const free = this.isModuleFreeFromPolicy(policy, k, billing);
        if (free) {
          modules[k] = { free: true, active: true };
          return;
        }
        const active = await this.hasActivationRecordsOnly(user, k, billing);
        modules[k] = { free: false, active };
      }),
    );
    return { billing_account: billing, modules };
  }

  private async findByIdempotencyKey(user: User, key: string): Promise<ModulePeriodActivation | null> {
    const k = key.trim();
    if (!k) return null;
    return this.repo.findOne({ where: { userId: user.id, idempotencyKey: k } });
  }

  private async findActivation(
    user: User,
    moduleKey: MarketModuleKey,
    billing: 'user' | 'school',
    billingPeriod: 'month' | 'year',
    periodLabel: string,
  ): Promise<ModulePeriodActivation | null> {
    if (billing === 'school' && user.school_id) {
      return this.repo.findOne({
        where: {
          schoolId: user.school_id,
          moduleKey,
          periodMonth: periodLabel,
          debitTarget: 'school',
          billingPeriod,
        },
      });
    }
    return this.repo.findOne({
      where: {
        userId: user.id,
        moduleKey,
        periodMonth: periodLabel,
        debitTarget: 'user',
        billingPeriod,
      },
    });
  }

  /** Ücretsiz kontrolü yapılmaz; yalnızca ay/yıl etkinleştirme kaydı (guard ile aynı mantık, ücretli modüller için). */
  private async hasActivationRecordsOnly(
    user: User,
    moduleKey: MarketModuleKey,
    billing: 'user' | 'school',
    now = new Date(),
  ): Promise<boolean> {
    if (isMarketBillingExempt(user.role as UserRole)) return true;
    const monthLabel = utcMonthLabel(now);
    const yearLabel = utcYearLabel(now);
    if (await this.findActivation(user, moduleKey, billing, 'month', monthLabel)) return true;
    if (await this.findActivation(user, moduleKey, billing, 'year', yearLabel)) return true;
    return false;
  }

  async hasActivationForCurrentPeriod(
    user: User,
    moduleKey: MarketModuleKey,
    billing: 'user' | 'school',
    now = new Date(),
  ): Promise<boolean> {
    if (isMarketBillingExempt(user.role as UserRole)) return true;
    if (await this.isModuleFreeForBilling(user, moduleKey, billing)) return true;
    return this.hasActivationRecordsOnly(user, moduleKey, billing, now);
  }

  private resolveActivationKind(
    policy: MarketPolicyConfig,
    moduleKey: MarketModuleKey,
    billing: 'user' | 'school',
    requested: 'month' | 'year' | undefined,
  ): 'month' | 'year' {
    const row = this.getModuleRow(policy, moduleKey);
    const scope = billing === 'school' ? row.school : row.teacher;
    const monthly = pairCost(scope.monthly.jeton, scope.monthly.ekders);
    const yearly = pairCost(scope.yearly.jeton, scope.yearly.ekders);
    const mc = hasTariffCost(monthly);
    const yc = hasTariffCost(yearly);

    if (requested) {
      if (requested === 'month' && !mc && yc) {
        throw new BadRequestException({
          code: 'INVALID_MODULE_ACTIVATION_PERIOD',
          message: 'Bu modül için yalnızca yıllık tarife tanımlı; billing_period: year kullanın.',
        });
      }
      if (requested === 'year' && !yc && mc) {
        throw new BadRequestException({
          code: 'INVALID_MODULE_ACTIVATION_PERIOD',
          message: 'Bu modül için yalnızca aylık tarife tanımlı; billing_period: month kullanın.',
        });
      }
      return requested;
    }
    if (mc) return 'month';
    if (yc) return 'year';
    return 'month';
  }

  async assertActivatedOrThrow(user: User, moduleKey: MarketModuleKey): Promise<void> {
    if (isMarketBillingExempt(user.role as UserRole)) return;
    const billing = resolveBillingAccount(user);
    if (await this.hasActivationForCurrentPeriod(user, moduleKey, billing)) return;
    const policy = await this.appConfig.getMarketPolicyConfig();
    const row = this.getModuleRow(policy, moduleKey);
    const scope = billing === 'school' ? row.school : row.teacher;
    const m = scope.monthly;
    const y = scope.yearly;
    throw new HttpException(
      {
        code: 'MODULE_ACTIVATION_REQUIRED',
        message:
          'Bu modülü kullanmak için Market üzerinden aylık veya yıllık tarifeye göre etkinleştirin.',
        details: {
          module: moduleKey,
          billing_account: billing,
          period_month: utcMonthLabel(),
          period_year: utcYearLabel(),
          required_tariff: {
            monthly: { jeton: m.jeton, ekders: m.ekders },
            yearly: { jeton: y.jeton, ekders: y.ekders },
          },
          activate_hint: 'Market → Modül etkinleştirme; ay veya yıl seçerek jeton/ek ders karşılığı onaylayın.',
        },
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }

  async assertAnyActivatedOrThrow(user: User, moduleKeys: string[]): Promise<void> {
    if (isMarketBillingExempt(user.role as UserRole)) return;
    const billing = resolveBillingAccount(user);
    for (const k of moduleKeys) {
      if (!MARKET_MODULE_KEYS.includes(k as MarketModuleKey)) continue;
      const mk = k as MarketModuleKey;
      if (await this.hasActivationForCurrentPeriod(user, mk, billing)) return;
      if (await this.isModuleFreeForBilling(user, mk, billing)) return;
    }
    throw new HttpException(
      {
        code: 'MODULE_ACTIVATION_REQUIRED',
        message: 'Bu işlem için ilgili modüllerden en az biri Market üzerinden etkinleştirilmeli veya ücretsiz tarifede olmalıdır.',
        details: { modules: moduleKeys, period_month: utcMonthLabel(), period_year: utcYearLabel() },
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }

  async activateModule(
    user: User,
    moduleKey: MarketModuleKey,
    billingPeriodInput?: 'month' | 'year',
    targetMonthRaw?: string,
    payWith?: 'jeton' | 'ekders',
    idempotencyKeyRaw?: string,
  ): Promise<{ ok: boolean; already_active: boolean; billing_period: 'month' | 'year'; period_label: string }> {
    if (isMarketBillingExempt(user.role as UserRole)) {
      return { ok: true, already_active: true, billing_period: 'month', period_label: utcMonthLabel() };
    }
    if (!MARKET_MODULE_KEYS.includes(moduleKey)) {
      throw new BadRequestException({ code: 'INVALID_MODULE', message: 'Geçersiz modül anahtarı.' });
    }
    const idempotencyKey = idempotencyKeyRaw?.trim().slice(0, 64) || undefined;
    if (idempotencyKey) {
      const idem = await this.findByIdempotencyKey(user, idempotencyKey);
      if (idem) {
        return {
          ok: true,
          already_active: true,
          billing_period: idem.billingPeriod,
          period_label: idem.periodMonth,
        };
      }
    }
    const billing = resolveBillingAccount(user);
    const policy = await this.appConfig.getMarketPolicyConfig();
    const kind = this.resolveActivationKind(policy, moduleKey, billing, billingPeriodInput);
    const yearLabel = utcYearLabel();
    const currentMonthLabel = utcMonthLabel();

    if (kind === 'year' && targetMonthRaw?.trim()) {
      throw new BadRequestException({
        code: 'INVALID_TARGET_MONTH',
        message: 'Yıllık etkinleştirmede target_month kullanılamaz.',
      });
    }

    let monthPeriodLabel = currentMonthLabel;
    if (kind === 'month') {
      const t = targetMonthRaw?.trim();
      if (t) {
        if (!/^\d{4}-\d{2}$/.test(t)) {
          throw new BadRequestException({ code: 'INVALID_TARGET_MONTH', message: 'target_month YYYY-MM olmalıdır.' });
        }
        if (t < currentMonthLabel) {
          throw new BadRequestException({
            code: 'INVALID_TARGET_MONTH',
            message: 'Geçmiş UTC ayı için etkinleştirme yapılamaz.',
          });
        }
        monthPeriodLabel = t;
      }
    }

    if (kind === 'month') {
      if (await this.findActivation(user, moduleKey, billing, 'year', yearLabel)) {
        return { ok: true, already_active: true, billing_period: 'month', period_label: monthPeriodLabel };
      }
      if (await this.findActivation(user, moduleKey, billing, 'month', monthPeriodLabel)) {
        return { ok: true, already_active: true, billing_period: 'month', period_label: monthPeriodLabel };
      }
    } else {
      if (await this.findActivation(user, moduleKey, billing, 'year', yearLabel)) {
        return { ok: true, already_active: true, billing_period: 'year', period_label: yearLabel };
      }
    }

    const pl = kind === 'month' ? monthPeriodLabel : yearLabel;

    if (await this.isModuleFreeForBilling(user, moduleKey, billing)) {
      await this.repo.save(
        this.repo.create({
          userId: user.id,
          schoolId: billing === 'school' ? user.school_id ?? null : null,
          moduleKey,
          billingPeriod: kind,
          periodMonth: pl,
          debitTarget: billing,
          idempotencyKey: idempotencyKey ?? null,
          debitJeton: null,
          debitEkders: null,
        }),
      );
      return { ok: true, already_active: false, billing_period: kind, period_label: pl };
    }

    const debited = await this.usage.debitTariffForActivationOrThrow(
      user,
      moduleKey,
      billing,
      kind === 'month' ? 'month' : 'year',
      payWith,
    );
    await this.repo.save(
      this.repo.create({
        userId: user.id,
        schoolId: billing === 'school' ? user.school_id ?? null : null,
        moduleKey,
        billingPeriod: kind,
        periodMonth: pl,
        debitTarget: billing,
        idempotencyKey: idempotencyKey ?? null,
        debitJeton: debited.debitJeton > 0 ? debited.debitJeton.toFixed(6) : null,
        debitEkders: debited.debitEkders > 0 ? debited.debitEkders.toFixed(6) : null,
      }),
    );
    return { ok: true, already_active: false, billing_period: kind, period_label: pl };
  }

  /** Etkinleştirme kayıtları (satın alma / ücretsiz kayıt zamanı); son işlemler önce. */
  async listActivationLedger(
    user: User,
    limit = 30,
  ): Promise<{
    items: Array<{
      id: string;
      module_key: string;
      billing_period: 'month' | 'year';
      period_label: string;
      debit_target: 'user' | 'school';
      debit_jeton: number | null;
      debit_ekders: number | null;
      created_at: string;
    }>;
  }> {
    if (isMarketBillingExempt(user.role as UserRole)) {
      return { items: [] };
    }
    const billing = resolveBillingAccount(user);
    const take = Math.min(Math.max(Number(limit) || 30, 1), 100);
    const qb = this.repo.createQueryBuilder('a');
    if (billing === 'school' && user.school_id) {
      qb.where('a.schoolId = :sid', { sid: user.school_id }).andWhere('a.debitTarget = :dt', { dt: 'school' });
    } else {
      qb.where('a.userId = :uid', { uid: user.id }).andWhere('a.debitTarget = :dt', { dt: 'user' });
    }
    qb.orderBy('a.createdAt', 'DESC').take(take);
    const rows = await qb.getMany();
    return {
      items: rows.map((r) => ({
        id: r.id,
        module_key: r.moduleKey,
        billing_period: r.billingPeriod,
        period_label: r.periodMonth,
        debit_target: r.debitTarget,
        debit_jeton: r.debitJeton != null ? Number(r.debitJeton) : null,
        debit_ekders: r.debitEkders != null ? Number(r.debitEkders) : null,
        created_at: r.createdAt.toISOString(),
      })),
    };
  }
}
