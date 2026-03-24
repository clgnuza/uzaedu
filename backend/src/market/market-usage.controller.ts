import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { UserRole } from '../types/enums';
import { MarketUsageService } from './market-usage.service';

@Controller('market/usage')
export class MarketUsageController {
  constructor(private readonly usage: MarketUsageService) {}

  @Get('summary')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  async summary(@CurrentUser() payload: CurrentUserPayload) {
    return this.usage.getSummary({
      userId: payload.userId,
      schoolId: payload.schoolId,
      role: payload.user.role as UserRole,
    });
  }

  @Get('breakdown')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  async breakdown(@CurrentUser() payload: CurrentUserPayload) {
    return this.usage.getBreakdown({
      userId: payload.userId,
      schoolId: payload.schoolId,
      role: payload.user.role as UserRole,
    });
  }

  @Get('ledger')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  async ledger(
    @CurrentUser() payload: CurrentUserPayload,
    @Query('scope') scope?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = Math.max(1, parseInt(page || '1', 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit || '30', 10) || 30));
    const wantSchool = scope === 'school' && payload.user.role === UserRole.school_admin && payload.schoolId;
    const { total, items } = await this.usage.listLedger(
      payload.userId,
      wantSchool ? 'school' : 'user',
      wantSchool ? payload.schoolId : null,
      p,
      l,
    );
    return {
      total,
      page: p,
      limit: l,
      scope: wantSchool ? 'school' : 'user',
      items: items.map((row) => ({
        id: row.id,
        module_key: row.moduleKey,
        jeton_debit: row.jetonDebit,
        ekders_debit: row.ekdersDebit,
        debit_target: row.debitTarget,
        school_id: row.schoolId,
        created_at: row.createdAt?.toISOString?.() ?? null,
      })),
    };
  }
}
