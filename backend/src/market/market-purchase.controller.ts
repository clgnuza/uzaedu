import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { UserRole } from '../types/enums';
import { MarketPurchaseService } from './market-purchase.service';
import { VerifyAndroidPurchaseDto } from './dto/verify-android-purchase.dto';
import { VerifyIosPurchaseDto } from './dto/verify-ios-purchase.dto';

@Controller('market/purchases')
export class MarketPurchaseController {
  constructor(private readonly service: MarketPurchaseService) {}

  @Post('verify-android')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async verifyAndroid(@CurrentUser() payload: CurrentUserPayload, @Body() dto: VerifyAndroidPurchaseDto) {
    const { ledger, duplicate } = await this.service.verifyAndroidPurchase(
      payload.userId,
      payload.schoolId,
      payload.user.role as UserRole,
      dto,
    );
    return {
      ledger_id: ledger.id,
      status: ledger.status,
      duplicate: duplicate ?? false,
      verification_note: ledger.verificationNote,
      credits_applied: ledger.creditsApplied,
      amount_credited: ledger.amountCredited,
      credit_target: ledger.creditTarget,
    };
  }

  @Post('verify-ios')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async verifyIos(@CurrentUser() payload: CurrentUserPayload, @Body() dto: VerifyIosPurchaseDto) {
    const { ledger, duplicate } = await this.service.verifyIosPurchase(
      payload.userId,
      payload.schoolId,
      payload.user.role as UserRole,
      dto,
    );
    return {
      ledger_id: ledger.id,
      status: ledger.status,
      duplicate: duplicate ?? false,
      verification_note: ledger.verificationNote,
      credits_applied: ledger.creditsApplied,
      amount_credited: ledger.amountCredited,
      credit_target: ledger.creditTarget,
    };
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  async mine(
    @CurrentUser() payload: CurrentUserPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = Math.max(1, parseInt(page || '1', 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit || '30', 10) || 30));
    const { total, items } = await this.service.listMine(payload.userId, { page: p, limit: l });
    return { total, page: p, limit: l, items };
  }

  @Get('school')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin)
  async schoolPurchases(
    @CurrentUser() payload: CurrentUserPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (!payload.schoolId) {
      return { total: 0, page: 1, limit: 30, items: [] };
    }
    const p = Math.max(1, parseInt(page || '1', 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit || '30', 10) || 30));
    const { total, items } = await this.service.listSchoolLedger(payload.schoolId, { page: p, limit: l });
    return { total, page: p, limit: l, items };
  }

  @Get('ledger')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin, UserRole.moderator)
  @RequireModule('market_policy')
  async ledger(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<{ total: number; page: number; limit: number; items: unknown[] }> {
    const p = Math.max(1, parseInt(page || '1', 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit || '50', 10) || 50));
    const { total, items } = await this.service.listLedger({ page: p, limit: l });
    return { total, page: p, limit: l, items };
  }

  @Get('anomalies')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin, UserRole.moderator)
  @RequireModule('market_policy')
  async anomalies(@Query('hours') hours?: string, @Query('min_count') minCount?: string) {
    const h = Math.min(168, Math.max(1, parseInt(hours || '24', 10) || 24));
    const m = Math.min(500, Math.max(3, parseInt(minCount || '20', 10) || 20));
    const rows = await this.service.anomalies({ hours: h, minCount: m });
    return { hours: h, min_count: m, items: rows };
  }
}
