import { BadRequestException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../app-config/app-config.service';
import { clampNonNegativeRatio } from '../app-config/market-policy.defaults';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../types/enums';
import {
  EntitlementService,
  ENTITLEMENT_EVRAK_URETIM,
  ENTITLEMENT_YILLIK_PLAN_URETIM,
} from '../entitlements/entitlement.service';
import { MarketWalletService } from './market-wallet.service';
import { MarketUsageService } from './market-usage.service';

@Injectable()
export class MarketEntitlementExchangeService {
  private readonly logger = new Logger(MarketEntitlementExchangeService.name);

  constructor(
    private readonly appConfig: AppConfigService,
    private readonly wallet: MarketWalletService,
    private readonly entitlements: EntitlementService,
    private readonly usage: MarketUsageService,
  ) {}

  async exchange(
    user: User,
    kind: 'yillik_plan_uretim' | 'evrak_uretim',
    quantity: number,
  ): Promise<{
    kind: string;
    quantity: number;
    debited_jeton: number;
    wallet: { user: { jeton: number; ekders: number } };
  }> {
    const policy = await this.appConfig.getMarketPolicyConfig();
    const ex = policy.entitlement_exchange;
    if (!ex?.enabled) {
      throw new BadRequestException({
        code: 'EXCHANGE_DISABLED',
        message: 'Jeton ile hak alışverişi kapalı. Yöneticiden açılmasını isteyin.',
      });
    }
    const rate =
      kind === 'yillik_plan_uretim'
        ? clampNonNegativeRatio(ex.jeton_per_yillik_plan_unit, 0)
        : clampNonNegativeRatio(ex.jeton_per_evrak_unit, 0);
    if (rate <= 0) {
      throw new BadRequestException({
        code: 'EXCHANGE_RATE_ZERO',
        message: 'Bu hak türü için jeton tarifesi tanımlı değil.',
      });
    }
    const qMax = Math.min(500, Math.max(1, Math.round(ex.max_units_per_request ?? 25)));
    const q = Math.min(qMax, Math.max(1, Math.floor(quantity)));
    const cost = Math.round(rate * q * 1e6) / 1e6;
    if (cost <= 0) {
      throw new BadRequestException({ code: 'BAD_INPUT', message: 'Hesaplanan jeton maliyeti geçersiz.' });
    }

    const ok = await this.wallet.tryDebitUser(user.id, { jeton: cost, ekders: 0 });
    if (!ok) {
      const bal = await this.wallet.getBalancesForActor({
        userId: user.id,
        schoolId: user.school_id,
        role: user.role as UserRole,
      });
      throw new HttpException(
        {
          code: 'INSUFFICIENT_MARKET_CREDIT',
          message: 'Jeton bakiyeniz yetersiz.',
          details: { required_jeton: cost, current: bal.user },
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    const entitlementType = kind === 'yillik_plan_uretim' ? ENTITLEMENT_YILLIK_PLAN_URETIM : ENTITLEMENT_EVRAK_URETIM;
    try {
      await this.entitlements.addEntitlementQuantity(user.id, entitlementType, q);
    } catch (e) {
      try {
        await this.wallet.applyCredit({
          userId: user.id,
          schoolId: user.school_id,
          role: user.role as UserRole,
          creditAccount: 'user',
          currencyKind: 'jeton',
          amount: cost,
        });
      } catch (refundErr) {
        this.logger.error(
          `Entitlement exchange refund failed user=${user.id} cost=${cost}: ${refundErr instanceof Error ? refundErr.message : refundErr}`,
        );
      }
      throw e;
    }

    await this.usage.recordDebit({
      userId: user.id,
      schoolId: null,
      debitTarget: 'user',
      moduleKey: 'entitlement_exchange',
      jeton: cost,
      ekders: 0,
    });

    const wallet = await this.wallet.getBalancesForActor({
      userId: user.id,
      schoolId: user.school_id,
      role: user.role as UserRole,
    });
    return { kind, quantity: q, debited_jeton: cost, wallet: { user: wallet.user } };
  }
}
