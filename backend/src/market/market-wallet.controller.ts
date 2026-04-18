import { Body, Controller, ForbiddenException, Get, Post, Query, UseGuards } from '@nestjs/common';
import { MarketRewardedAdSsvService } from './market-rewarded-ad-ssv.service';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { UserRole } from '../types/enums';
import type { MarketModuleKey } from '../app-config/market-policy.defaults';
import { MarketWalletService } from './market-wallet.service';
import { MarketModuleActivationService } from './market-module-activation.service';
import { ActivateModuleDto } from './dto/activate-module.dto';
import { MarketSchoolCreditService } from './market-school-credit.service';
import { MarketUserCreditService } from './market-user-credit.service';
import { MarketEntitlementExchangeService } from './market-entitlement-exchange.service';
import { ExchangeEntitlementDto } from './dto/exchange-entitlement.dto';

function parseUtcDayInclusive(s: string | undefined): Date | null {
  if (!s?.trim()) return null;
  const t = s.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) {
    const y = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10) - 1;
    const d = parseInt(m[3], 10);
    return new Date(Date.UTC(y, mo, d, 0, 0, 0, 0));
  }
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseUtcDayEndInclusive(s: string | undefined): Date | null {
  if (!s?.trim()) return null;
  const t = s.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) {
    const y = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10) - 1;
    const d = parseInt(m[3], 10);
    return new Date(Date.UTC(y, mo, d, 23, 59, 59, 999));
  }
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

@Controller('market')
export class MarketWalletController {
  constructor(
    private readonly wallet: MarketWalletService,
    private readonly schoolCredits: MarketSchoolCreditService,
    private readonly userCredits: MarketUserCreditService,
    private readonly rewardedAdSsv: MarketRewardedAdSsvService,
    private readonly moduleActivation: MarketModuleActivationService,
    private readonly entitlementExchange: MarketEntitlementExchangeService,
  ) {}

  /**
   * Ücretli modül: superadmin tarifesindeki aylık veya yıllık jeton/ek ders ile bir kez etkinleştirir.
   * billing_period yoksa: aylık tarife varsa ay, yoksa yıl. Tarife tamamen 0 ise ücretsiz kayıt.
   */
  @Post('modules/activate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  async activateModule(@CurrentUser() payload: CurrentUserPayload, @Body() dto: ActivateModuleDto) {
    return this.moduleActivation.activateModule(
      payload.user,
      dto.module_key as MarketModuleKey,
      dto.billing_period,
      dto.target_month,
      dto.pay_with,
      dto.idempotency_key,
    );
  }

  /** Modülün tüm sekmelerinde tek doğruluk: ücretli ve etkin değilse arayüz tamamen kilitlenir. */
  @Get('modules/activation-status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  async getModulesActivationStatus(@CurrentUser() payload: CurrentUserPayload) {
    return this.moduleActivation.getActivationStatus(payload.user);
  }

  @Get('modules/activation-ledger')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  async getActivationLedger(@CurrentUser() payload: CurrentUserPayload, @Query('limit') limit?: string) {
    const n = limit ? parseInt(limit, 10) : 30;
    return this.moduleActivation.listActivationLedger(payload.user, Number.isFinite(n) ? n : 30);
  }

  @Get('wallet')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  async getWallet(@CurrentUser() payload: CurrentUserPayload) {
    return this.wallet.getBalancesForActor({
      userId: payload.userId,
      schoolId: payload.schoolId,
      role: payload.user.role as UserRole,
    });
  }

  /** Jeton karşılığı yıllık plan / evrak üretim kotası (Market politikası). */
  @Post('entitlements/exchange')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async exchangeEntitlement(@CurrentUser() payload: CurrentUserPayload, @Body() dto: ExchangeEntitlementDto) {
    return this.entitlementExchange.exchange(payload.user, dto.kind, dto.quantity);
  }

  /** Okul yöneticisi: kendi okuluna superadmin tarafından eklenen jeton/ek ders ve ekleyen bilgisi */
  @Get('wallet/school-credits')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin)
  async schoolManualCredits(
    @CurrentUser() payload: CurrentUserPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (!payload.schoolId) {
      throw new ForbiddenException({ code: 'SCHOOL_REQUIRED', message: 'Okul bilgisi gerekli.' });
    }
    const p = Math.max(1, parseInt(page || '1', 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit || '20', 10) || 20));
    const res = await this.schoolCredits.listHistory({
      schoolId: payload.schoolId,
      fromInclusive: parseUtcDayInclusive(from),
      toInclusive: parseUtcDayEndInclusive(to),
      page: p,
      limit: l,
    });
    return { ...res, page: p, limit: l };
  }

  /** Öğretmen: AdMob SSV ile kazanılan ödüllü reklam jetonları */
  @Get('wallet/rewarded-ad-credits')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher)
  async rewardedAdCredits(
    @CurrentUser() payload: CurrentUserPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = Math.max(1, parseInt(page || '1', 10) || 1);
    const l = Math.min(50, Math.max(1, parseInt(limit || '20', 10) || 20));
    const { total, items } = await this.rewardedAdSsv.listLedgerForTeacher(payload.userId, p, l);
    return {
      page: p,
      limit: l,
      total,
      items: items.map((r) => ({
        id: r.id,
        transaction_id: r.transactionId,
        jeton_credit: r.jetonCredit,
        ad_unit_key: r.adUnitKey,
        created_at: r.createdAt?.toISOString?.() ?? null,
      })),
    };
  }

  /** Öğretmen: superadmin tarafından bireysel cüzdana eklenen jeton/ek ders geçmişi */
  @Get('wallet/user-credits')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher)
  async userManualCredits(
    @CurrentUser() payload: CurrentUserPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = Math.max(1, parseInt(page || '1', 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit || '20', 10) || 20));
    const res = await this.userCredits.listHistory({
      targetUserId: payload.userId,
      fromInclusive: parseUtcDayInclusive(from),
      toInclusive: parseUtcDayEndInclusive(to),
      page: p,
      limit: l,
    });
    return { ...res, page: p, limit: l };
  }
}
