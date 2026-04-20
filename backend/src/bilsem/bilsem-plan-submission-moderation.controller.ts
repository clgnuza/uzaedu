import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../types/enums';
import { BilsemPlanSubmissionService } from './bilsem-plan-submission.service';
import { PublishBilsemPlanSubmissionDto, RejectBilsemPlanSubmissionDto } from './dto/moderate-bilsem-plan-submission.dto';

@Controller('bilsem/plan-submissions/moderation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.superadmin, UserRole.moderator)
export class BilsemPlanSubmissionModerationController {
  constructor(private readonly service: BilsemPlanSubmissionService) {}

  @Get('pending')
  async listPending() {
    return this.service.listPending();
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
}
