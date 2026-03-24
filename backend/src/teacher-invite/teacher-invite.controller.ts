import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { UserRole } from '../types/enums';
import { TeacherInviteService } from './teacher-invite.service';

@Controller('teacher-invite')
@Throttle({ default: { limit: 90, ttl: 60000 } })
export class TeacherInviteController {
  constructor(private readonly invites: TeacherInviteService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher)
  async me(@CurrentUser() payload: CurrentUserPayload) {
    const summary = await this.invites.getMySummary(payload.userId);
    return summary;
  }

  @Post('ensure-code')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher)
  async ensureCode(@CurrentUser() payload: CurrentUserPayload) {
    return this.invites.ensureMyCode(payload.userId);
  }

  @Get('redemptions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher)
  async redemptions(
    @CurrentUser() payload: CurrentUserPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = Math.max(1, parseInt(page || '1', 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit || '20', 10) || 20));
    return this.invites.listRedemptions(payload.userId, p, l);
  }
}
