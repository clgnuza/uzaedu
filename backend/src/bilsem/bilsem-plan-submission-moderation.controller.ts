import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../types/enums';
import { BilsemPlanSubmissionService } from './bilsem-plan-submission.service';
import {
  PublishBilsemPlanSubmissionDto,
  RejectBilsemPlanSubmissionDto,
  UnpublishBilsemPlanSubmissionDto,
} from './dto/moderate-bilsem-plan-submission.dto';

@Controller('bilsem/plan-submissions/moderation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.superadmin, UserRole.moderator)
export class BilsemPlanSubmissionModerationController {
  constructor(private readonly service: BilsemPlanSubmissionService) {}

  @Get('pending')
  async listPending(
    @Query('academic_year') academicYear?: string,
    @Query('ana_grup') anaGrup?: string,
    @Query('q') q?: string,
  ) {
    return this.service.listPending({ academic_year: academicYear, ana_grup: anaGrup, q });
  }

  @Get('summary')
  async moderationDashboard() {
    return this.service.getModerationDashboard();
  }

  @Get('history')
  async moderationHistory(
    @Query('limit') limit?: string,
    @Query('academic_year') academicYear?: string,
    @Query('ana_grup') anaGrup?: string,
    @Query('q') q?: string,
  ) {
    const n = limit ? parseInt(limit, 10) : 30;
    return this.service.listModerationHistory(Number.isFinite(n) ? n : 30, {
      academic_year: academicYear,
      ana_grup: anaGrup,
      q,
    });
  }

  @Get(':id/validate')
  async validateForPublish(@Param('id') id: string) {
    return this.service.validateForModeration(id);
  }

  @Get(':id')
  async getOne(@Param('id') id: string, @CurrentUser() me: CurrentUserPayload) {
    return this.service.getOne(id, me.userId, me.role);
  }

  @Post(':id/publish')
  async publish(
    @Param('id') id: string,
    @CurrentUser() me: CurrentUserPayload,
    @Body() body: PublishBilsemPlanSubmissionDto,
  ) {
    return this.service.publish(id, me.userId, body);
  }

  @Post(':id/reject')
  async reject(
    @Param('id') id: string,
    @CurrentUser() me: CurrentUserPayload,
    @Body() body: RejectBilsemPlanSubmissionDto,
  ) {
    return this.service.reject(id, me.userId, body.review_note);
  }

  @Post(':id/unpublish')
  async unpublish(
    @Param('id') id: string,
    @CurrentUser() me: CurrentUserPayload,
    @Body() body: UnpublishBilsemPlanSubmissionDto,
  ) {
    return this.service.unpublish(id, me.userId, body);
  }
}
