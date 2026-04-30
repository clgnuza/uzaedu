import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../types/enums';
import {
  PublishYillikPlanSubmissionDto,
  RejectYillikPlanSubmissionDto,
  UnpublishYillikPlanSubmissionDto,
} from './dto/moderate-yillik-plan-submission.dto';
import { YillikPlanSubmissionService } from './yillik-plan-submission.service';

@Controller('yillik-plan-icerik/submissions/moderation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.superadmin, UserRole.moderator)
export class YillikPlanSubmissionModerationController {
  constructor(private readonly service: YillikPlanSubmissionService) {}

  @Get('pending')
  async listPending(@Query('q') q?: string) {
    return this.service.listPending(q);
  }

  @Get('summary')
  async moderationDashboard() {
    return this.service.getModerationDashboard();
  }

  @Get('history')
  async moderationHistory(@Query('limit') limit?: string, @Query('q') q?: string) {
    const n = limit ? parseInt(limit, 10) : 30;
    return this.service.listModerationHistory(Number.isFinite(n) ? n : 30, q);
  }

  @Get(':id')
  async getOne(@Param('id') id: string, @CurrentUser() me: CurrentUserPayload) {
    return this.service.getOne(id, me.userId, me.role);
  }

  @Post(':id/publish')
  async publish(@Param('id') id: string, @CurrentUser() me: CurrentUserPayload, @Body() body: PublishYillikPlanSubmissionDto) {
    return this.service.publish(id, me.userId, body);
  }

  @Post(':id/reject')
  async reject(@Param('id') id: string, @CurrentUser() me: CurrentUserPayload, @Body() body: RejectYillikPlanSubmissionDto) {
    return this.service.reject(id, me.userId, body.review_note);
  }

  @Post(':id/unpublish')
  async unpublish(@Param('id') id: string, @CurrentUser() me: CurrentUserPayload, @Body() body: UnpublishYillikPlanSubmissionDto) {
    return this.service.unpublish(id, me.userId, body);
  }
}
