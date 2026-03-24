import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { AppConfigService } from '../app-config/app-config.service';
import type { MarketModuleKey, MarketModuleScopeUsage } from '../app-config/market-policy.defaults';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../types/enums';
import { MarketWalletService } from './market-wallet.service';
import { MarketUsageService } from './market-usage.service';

function isMarketBillingExempt(role: UserRole): boolean {
  return role === UserRole.superadmin || role === UserRole.moderator;
}

function roundCost(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 1e6) / 1e6;
}

function pickUsagePair(side: MarketModuleScopeUsage, usagePeriod: 'month' | 'year') {
  return usagePeriod === 'year' ? side.yearly : side.monthly;
}

@Injectable()
export class MarketModuleUsageService {
  constructor(
    private readonly appConfig: AppConfigService,
    private readonly wallet: MarketWalletService,
    private readonly usage: MarketUsageService,
  ) {}

  /**
   * true: ücret marketten alındı VEYA fiyat yapılandırması yok/boş değil ve düşüm yapıldı; exempt ise true (entitlement kullanılmaz).
   * false: market fiyatı 0 — evrak entitlement devreye girer.
   */
  async tryConsumeForDocument(
    user: User,
    billingAccount: 'user' | 'school',
    opts?: { usagePeriod?: 'month' | 'year' },
  ): Promise<boolean> {
    if (isMarketBillingExempt(user.role as UserRole)) {
      return true;
    }
    const usagePeriod = opts?.usagePeriod === 'year' ? 'year' : 'month';
    const policy = await this.appConfig.getMarketPolicyConfig();
    const row = policy.module_prices?.document;
    if (!row) {
      return false;
    }
    const scope = billingAccount === 'school' ? row.school : row.teacher;
    const side = pickUsagePair(scope, usagePeriod);
    const needJeton = roundCost(side.jeton);
    const needEkders = roundCost(side.ekders);
    if (needJeton <= 0 && needEkders <= 0) {
      return false;
    }
    await this.debitOrThrow(user, billingAccount, needJeton, needEkders, 'document');
    return true;
  }

  /** Fiyat > 0 ise düş; 0 ise no-op. Yetersiz bakiye → 402. */
  async chargePaidModuleIfPriced(
    user: User,
    moduleKey: MarketModuleKey,
    opts?: { billingAccount?: 'user' | 'school'; multiplier?: number; usagePeriod?: 'month' | 'year' },
  ): Promise<void> {
    if (isMarketBillingExempt(user.role as UserRole)) {
      return;
    }
    const usagePeriod = opts?.usagePeriod === 'year' ? 'year' : 'month';
    const mult = Math.max(1, Math.min(10_000, Math.floor(opts?.multiplier ?? 1)));
    const policy = await this.appConfig.getMarketPolicyConfig();
    const row = policy.module_prices?.[moduleKey];
    if (!row) {
      return;
    }
    const billingAccount = opts?.billingAccount ?? 'user';
    const scope = billingAccount === 'school' ? row.school : row.teacher;
    const side = pickUsagePair(scope, usagePeriod);
    const needJeton = roundCost(side.jeton * mult);
    const needEkders = roundCost(side.ekders * mult);
    if (needJeton <= 0 && needEkders <= 0) {
      return;
    }
    await this.debitOrThrow(user, billingAccount, needJeton, needEkders, moduleKey);
  }

  private async debitOrThrow(
    user: User,
    billingAccount: 'user' | 'school',
    needJeton: number,
    needEkders: number,
    moduleKey: MarketModuleKey,
  ): Promise<void> {
    if (billingAccount === 'school') {
      if (user.role !== UserRole.school_admin) {
        throw new BadRequestException({
          code: 'INVALID_BILLING_ACCOUNT',
          message: 'Okul cüzdanı yalnızca okul yöneticisi için kullanılabilir.',
        });
      }
      const schoolId = user.school_id;
      if (!schoolId) {
        throw new BadRequestException({
          code: 'SCHOOL_REQUIRED',
          message: 'Okul cüzdanı için okul bilgisi gerekli.',
        });
      }
      const ok = await this.wallet.tryDebitSchool(schoolId, { jeton: needJeton, ekders: needEkders });
      if (!ok) {
        const bal = await this.wallet.getBalancesForActor({
          userId: user.id,
          schoolId,
          role: user.role as UserRole,
        });
        throw new HttpException(
          {
            code: 'INSUFFICIENT_MARKET_CREDIT',
            message: 'Okul jeton / ek ders bakiyesi yetersiz.',
            details: {
              module: moduleKey,
              billing_account: 'school',
              required: { jeton: needJeton, ekders: needEkders },
              current: bal.school ?? { jeton: 0, ekders: 0 },
            },
          },
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
      await this.usage.recordDebit({
        userId: user.id,
        schoolId,
        debitTarget: 'school',
        moduleKey,
        jeton: needJeton,
        ekders: needEkders,
      });
      return;
    }

    const ok = await this.wallet.tryDebitUser(user.id, { jeton: needJeton, ekders: needEkders });
    if (!ok) {
      const bal = await this.wallet.getBalancesForActor({
        userId: user.id,
        schoolId: user.school_id,
        role: user.role as UserRole,
      });
      throw new HttpException(
        {
          code: 'INSUFFICIENT_MARKET_CREDIT',
          message: 'Jeton / ek ders bakiyeniz yetersiz.',
          details: {
            module: moduleKey,
            billing_account: 'user',
            required: { jeton: needJeton, ekders: needEkders },
            current: bal.user,
          },
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
    await this.usage.recordDebit({
      userId: user.id,
      schoolId: null,
      debitTarget: 'user',
      moduleKey,
      jeton: needJeton,
      ekders: needEkders,
    });
  }
}
