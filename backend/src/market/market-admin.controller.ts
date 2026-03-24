import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { UserRole } from '../types/enums';
import { MarketPurchaseService } from './market-purchase.service';
import { MarketUsageService } from './market-usage.service';
import { MarketSchoolCreditService } from './market-school-credit.service';
import { MarketUserCreditService } from './market-user-credit.service';
import { MarketRewardedAdSsvService } from './market-rewarded-ad-ssv.service';
import { AddSchoolMarketCreditDto } from './dto/add-school-market-credit.dto';

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

function utcMonthBounds(): { start: Date; end: Date } {
  const n = new Date();
  return {
    start: new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1, 0, 0, 0, 0)),
    end: new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() + 1, 1, 0, 0, 0, 0)),
  };
}

function utcYearBounds(): { start: Date; end: Date } {
  const n = new Date();
  return {
    start: new Date(Date.UTC(n.getUTCFullYear(), 0, 1, 0, 0, 0, 0)),
    end: new Date(Date.UTC(n.getUTCFullYear() + 1, 0, 1, 0, 0, 0, 0)),
  };
}

@Controller('market/admin')
export class MarketAdminController {
  constructor(
    private readonly purchase: MarketPurchaseService,
    private readonly usage: MarketUsageService,
    private readonly schoolCredits: MarketSchoolCreditService,
    private readonly userCredits: MarketUserCreditService,
    private readonly rewardedAdSsv: MarketRewardedAdSsvService,
  ) {}

  /** Superadmin: ödüllü reklam jeton kazanım geçmişi (AdMob SSV) */
  @Get('rewarded-ad-ledger')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  async rewardedAdLedger(@Query('page') page?: string, @Query('limit') limit?: string) {
    const p = Math.max(1, parseInt(page || '1', 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit || '30', 10) || 30));
    const { total, items } = await this.rewardedAdSsv.listLedgerAdmin(p, l);
    return {
      page: p,
      limit: l,
      total,
      items: items.map((r) => ({
        id: r.id,
        user_id: r.userId,
        transaction_id: r.transactionId,
        jeton_credit: r.jetonCredit,
        ad_unit_key: r.adUnitKey,
        created_at: r.createdAt?.toISOString?.() ?? null,
      })),
    };
  }

  @Get('summary')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin, UserRole.moderator)
  @RequireModule('market_policy')
  async summary() {
    const ml = utcMonthBounds();
    const yl = utcYearBounds();
    const now = new Date();
    const period_labels = {
      month: `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`,
      year: String(now.getUTCFullYear()),
    };
    const [pMonth, pYear, cMonth, cYear] = await Promise.all([
      this.purchase.getAdminPurchaseCreditsForRange(ml.start, ml.end),
      this.purchase.getAdminPurchaseCreditsForRange(yl.start, yl.end),
      this.usage.getPlatformConsumptionForRange(ml.start, ml.end),
      this.usage.getPlatformConsumptionForRange(yl.start, yl.end),
    ]);
    return {
      period_labels,
      purchases: {
        /** Mağaza doğrulaması sonrası bakiyeye eklenen jeton/ek ders (IAP) */
        month: pMonth,
        year: pYear,
      },
      consumption: {
        /** Modül kullanımında cüzdandan düşen toplamlar */
        month: cMonth,
        year: cYear,
      },
    };
  }

  @Get('consumption-ledger')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin, UserRole.moderator)
  @RequireModule('market_policy')
  async consumptionLedger(@Query('page') page?: string, @Query('limit') limit?: string) {
    const p = Math.max(1, parseInt(page || '1', 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit || '20', 10) || 20));
    const { total, items } = await this.usage.listAllConsumptionLedger({ page: p, limit: l });
    return {
      total,
      page: p,
      limit: l,
      items: items.map((row) => ({
        id: row.id,
        user_id: row.userId,
        school_id: row.schoolId,
        module_key: row.moduleKey,
        jeton_debit: row.jetonDebit,
        ekders_debit: row.ekdersDebit,
        debit_target: row.debitTarget,
        created_at: row.createdAt?.toISOString?.() ?? null,
      })),
    };
  }

  /** Superadmin: tüm okullar — manuel market yükleme kayıtları (detaylı liste) */
  @Get('school-credits')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  async allSchoolCredits(
    @Query('school_id') schoolId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = Math.max(1, parseInt(page || '1', 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit || '20', 10) || 20));
    const fromInclusive = parseUtcDayInclusive(from);
    const toInclusive = parseUtcDayEndInclusive(to);
    const res = await this.schoolCredits.listAllPlatform({
      schoolId: schoolId?.trim() || null,
      fromInclusive,
      toInclusive,
      page: p,
      limit: l,
    });
    return { ...res, page: p, limit: l };
  }

  /** Superadmin: tüm öğretmenler — bireysel manuel market yükleme kayıtları */
  @Get('teacher-credits')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  async allTeacherCredits(
    @Query('user_id') userId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = Math.max(1, parseInt(page || '1', 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit || '20', 10) || 20));
    const fromInclusive = parseUtcDayInclusive(from);
    const toInclusive = parseUtcDayEndInclusive(to);
    const res = await this.userCredits.listAllPlatform({
      targetUserId: userId?.trim() || null,
      fromInclusive,
      toInclusive,
      page: p,
      limit: l,
    });
    return { ...res, page: p, limit: l };
  }

  /** Superadmin: öğretmene jeton / ek ders yükleme geçmişi */
  @Get('users/:userId/credits')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  async userCreditsHistory(
    @Param('userId') userId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = Math.max(1, parseInt(page || '1', 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit || '20', 10) || 20));
    const fromInclusive = parseUtcDayInclusive(from);
    const toInclusive = parseUtcDayEndInclusive(to);
    const res = await this.userCredits.listHistory({
      targetUserId: userId,
      fromInclusive,
      toInclusive,
      page: p,
      limit: l,
    });
    return { ...res, page: p, limit: l };
  }

  /** Superadmin: öğretmene jeton / ek ders ekle (bireysel cüzdan) */
  @Post('users/:userId/credits')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  async addUserCredits(
    @Param('userId') userId: string,
    @Body() dto: AddSchoolMarketCreditDto,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    const row = await this.userCredits.applyCredit({
      targetUserId: userId,
      createdByUserId: payload.userId,
      jeton: dto.jeton ?? 0,
      ekders: dto.ekders ?? 0,
      note: dto.note,
    });
    return {
      id: row.id,
      jeton_credit: row.jetonCredit,
      ekders_credit: row.ekdersCredit,
      note: row.note,
      created_at: row.createdAt?.toISOString?.() ?? null,
    };
  }

  /** Superadmin: okula jeton / ek ders yükleme geçmişi */
  @Get('schools/:schoolId/credits')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  async schoolCreditsHistory(
    @Param('schoolId') schoolId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = Math.max(1, parseInt(page || '1', 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit || '20', 10) || 20));
    const fromInclusive = parseUtcDayInclusive(from);
    const toInclusive = parseUtcDayEndInclusive(to);
    const res = await this.schoolCredits.listHistory({
      schoolId,
      fromInclusive,
      toInclusive,
      page: p,
      limit: l,
    });
    return { ...res, page: p, limit: l };
  }

  /** Superadmin: okula jeton / ek ders ekle */
  @Post('schools/:schoolId/credits')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  async addSchoolCredits(
    @Param('schoolId') schoolId: string,
    @Body() dto: AddSchoolMarketCreditDto,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    const row = await this.schoolCredits.applyCredit({
      schoolId,
      createdByUserId: payload.userId,
      jeton: dto.jeton ?? 0,
      ekders: dto.ekders ?? 0,
      note: dto.note,
    });
    return {
      id: row.id,
      jeton_credit: row.jetonCredit,
      ekders_credit: row.ekdersCredit,
      note: row.note,
      created_at: row.createdAt?.toISOString?.() ?? null,
    };
  }
}
