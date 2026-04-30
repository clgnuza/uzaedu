import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequireSchoolModuleGuard } from '../common/guards/require-school-module.guard';
import { RequireSchoolModule } from '../common/decorators/require-school-module.decorator';
import { RequireModuleActivationGuard } from '../market/guards/require-module-activation.guard';
import { UserRole } from '../types/enums';
import { BilsemPlanEngagementService } from './bilsem-plan-engagement.service';
import { BilsemPlanEngagementCommentDto } from './dto/bilsem-plan-engagement.dto';

@Controller('bilsem/plan-engagement')
@UseGuards(JwtAuthGuard, RolesGuard, RequireSchoolModuleGuard, RequireModuleActivationGuard)
@RequireSchoolModule('bilsem')
export class BilsemPlanEngagementController {
  constructor(private readonly engagement: BilsemPlanEngagementService) {}

  /** Seçilen ders/ana/alt/yıl için topluluk planı kaynağı + beğeni + yorumlar */
  @Get('source')
  @Roles(UserRole.teacher, UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  async source(
    @Query('subject_code') subjectCode: string,
    @Query('ana_grup') anaGrup: string,
    @Query('academic_year') academicYear: string,
    @Query('alt_grup') altGrup: string | undefined,
    @CurrentUser() me: CurrentUserPayload,
  ) {
    if (!subjectCode?.trim() || !anaGrup?.trim() || !academicYear?.trim()) {
      throw new BadRequestException({
        code: 'PARAMS',
        message: 'subject_code, ana_grup ve academic_year zorunludur.',
      });
    }
    return this.engagement.getSourceInfo(
      subjectCode,
      anaGrup,
      academicYear,
      altGrup?.trim() || null,
      me.userId,
    );
  }

  @Post(':submissionId/like')
  @Roles(UserRole.teacher, UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  async like(
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @CurrentUser() me: CurrentUserPayload,
  ) {
    return this.engagement.toggleLike(submissionId, me.userId);
  }

  @Post(':submissionId/comments')
  @Roles(UserRole.teacher, UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  async addComment(
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @CurrentUser() me: CurrentUserPayload,
    @Body() dto: BilsemPlanEngagementCommentDto,
  ) {
    return this.engagement.addComment(submissionId, me.userId, dto.body);
  }
}
