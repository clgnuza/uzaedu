import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequireSchoolModuleGuard } from '../common/guards/require-school-module.guard';
import { RequireSchoolModule } from '../common/decorators/require-school-module.decorator';
import { RequireModuleActivationGuard } from '../market/guards/require-module-activation.guard';
import { UserRole } from '../types/enums';
import { BilsemPlanSubmissionService } from './bilsem-plan-submission.service';
import { CreateBilsemPlanSubmissionDto } from './dto/create-bilsem-plan-submission.dto';
import { UpdateBilsemPlanSubmissionDto } from './dto/update-bilsem-plan-submission.dto';

@Controller('bilsem/plan-submissions')
export class BilsemPlanSubmissionController {
  constructor(private readonly service: BilsemPlanSubmissionService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, RequireSchoolModuleGuard, RequireModuleActivationGuard)
  @RequireSchoolModule('bilsem')
  @Roles(UserRole.teacher, UserRole.school_admin)
  async create(@CurrentUser() me: CurrentUserPayload, @Body() dto: CreateBilsemPlanSubmissionDto) {
    return this.service.createDraft(me.userId, me.schoolId ?? null, dto);
  }

  /** İki segment: `/:id` ile çakışmaması için `mine` değil. */
  @Get('author/me')
  @UseGuards(JwtAuthGuard, RolesGuard, RequireSchoolModuleGuard, RequireModuleActivationGuard)
  @RequireSchoolModule('bilsem')
  @Roles(UserRole.teacher, UserRole.school_admin)
  async listMine(@CurrentUser() me: CurrentUserPayload) {
    return this.service.listMine(me.userId);
  }

  /** Jeton / Word kullanım özeti (plan katkı raporlama). */
  @Get('author/summary')
  @UseGuards(JwtAuthGuard, RolesGuard, RequireSchoolModuleGuard, RequireModuleActivationGuard)
  @RequireSchoolModule('bilsem')
  @Roles(UserRole.teacher, UserRole.school_admin)
  async authorSummary(@CurrentUser() me: CurrentUserPayload) {
    return this.service.getAuthorSummary(me.userId);
  }

  @Get('meta/subjects')
  @UseGuards(JwtAuthGuard, RolesGuard, RequireSchoolModuleGuard, RequireModuleActivationGuard)
  @RequireSchoolModule('bilsem')
  @Roles(UserRole.teacher, UserRole.school_admin)
  async listBilsemPlanDraftSubjects() {
    return this.service.listBilsemPlanDraftSubjects();
  }

  @Get(':id/usage')
  @UseGuards(JwtAuthGuard, RolesGuard, RequireSchoolModuleGuard, RequireModuleActivationGuard)
  @RequireSchoolModule('bilsem')
  @Roles(UserRole.teacher, UserRole.school_admin)
  async submissionUsage(@Param('id') id: string, @CurrentUser() me: CurrentUserPayload) {
    return this.service.getSubmissionUsageForAuthor(id, me.userId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, RequireSchoolModuleGuard, RequireModuleActivationGuard)
  @RequireSchoolModule('bilsem')
  @Roles(UserRole.teacher, UserRole.school_admin)
  async getOne(@Param('id') id: string, @CurrentUser() me: CurrentUserPayload) {
    return this.service.getOne(id, me.userId, me.role);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, RequireSchoolModuleGuard, RequireModuleActivationGuard)
  @RequireSchoolModule('bilsem')
  @Roles(UserRole.teacher, UserRole.school_admin)
  async updateDraft(
    @Param('id') id: string,
    @CurrentUser() me: CurrentUserPayload,
    @Body() dto: UpdateBilsemPlanSubmissionDto,
  ) {
    return this.service.updateDraft(id, me.userId, dto);
  }

  @Post(':id/submit')
  @UseGuards(JwtAuthGuard, RolesGuard, RequireSchoolModuleGuard, RequireModuleActivationGuard)
  @RequireSchoolModule('bilsem')
  @Roles(UserRole.teacher, UserRole.school_admin)
  async submit(@Param('id') id: string, @CurrentUser() me: CurrentUserPayload) {
    return this.service.submit(id, me.userId);
  }

  @Post(':id/withdraw')
  @UseGuards(JwtAuthGuard, RolesGuard, RequireSchoolModuleGuard, RequireModuleActivationGuard)
  @RequireSchoolModule('bilsem')
  @Roles(UserRole.teacher, UserRole.school_admin)
  async withdraw(@Param('id') id: string, @CurrentUser() me: CurrentUserPayload) {
    return this.service.withdraw(id, me.userId);
  }
}
