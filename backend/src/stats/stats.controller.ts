import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { UserRole } from '../types/enums';
import { StatsService } from './stats.service';

@Controller('stats')
@UseGuards(JwtAuthGuard)
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get()
  async get(@CurrentUser() payload: CurrentUserPayload) {
    const role = payload.role as UserRole;
    const schoolId = payload.schoolId ?? null;
    return this.statsService.getStats(role, schoolId);
  }
}
