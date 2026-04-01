import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { AppConfigService } from '../app-config/app-config.service';
import {
  buildDefaultModulePrices,
  type MarketModuleKey,
  type MarketModuleScopeUsage,
  type MarketPolicyConfig,
} from '../app-config/market-policy.defaults';
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

  private getModuleRow(policy: MarketPolicyConfig, moduleKey: MarketModuleKey) {
    return policy.module_prices?.[moduleKey] ?? buildDefaultModulePrices()[moduleKey];
  }

  /**
   * Modül etkinleştirme: superadmin tarifesindeki aylık veya yıllık jeton/ek ders (tek sefer).
   * İlgili tarife kalemi 0 ise düşüm yapılmaz.
   */
  async debitTariffForActivationOrThrow(
    user: User,
    moduleKey: MarketModuleKey,
    billingAccount: 'user' | 'school',
    usagePeriod: 'month' | 'year',
    payWithInput?: 'jeton' | 'ekders',
  ): Promise<{ debitJeton: number; debitEkders: number }> {
    if (isMarketBillingExempt(user.role as UserRole)) {
      return { debitJeton: 0, debitEkders: 0 };
    }
    const policy = await this.appConfig.getMarketPolicyConfig();
    const row = this.getModuleRow(policy, moduleKey);
    const scope = billingAccount === 'school' ? row.school : row.teacher;
    const side = pickUsagePair(scope, usagePeriod);
    const needJeton = roundCost(side.jeton);
    const needEkders = roundCost(side.ekders);
    if (needJeton <= 0 && needEkders <= 0) {
      return { debitJeton: 0, debitEkders: 0 };
    }
    let debitJeton = 0;
    let debitEkders = 0;
    if (needJeton > 0 && needEkders <= 0) {
      debitJeton = needJeton;
    } else if (needEkders > 0 && needJeton <= 0) {
      debitEkders = needEkders;
    } else {
      if (payWithInput !== 'jeton' && payWithInput !== 'ekders') {
        throw new BadRequestException({
          code: 'PAY_WITH_REQUIRED',
          message: 'Bu tarifede hem jeton hem ek ders tutarı var; pay_with: jeton veya ekders gönderin.',
        });
      }
      if (payWithInput === 'jeton') debitJeton = needJeton;
      else debitEkders = needEkders;
    }
    await this.debitOrThrow(user, billingAccount, debitJeton, debitEkders, moduleKey);
    return { debitJeton, debitEkders };
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
