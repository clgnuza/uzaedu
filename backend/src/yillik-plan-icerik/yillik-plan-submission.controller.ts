import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequireSchoolModuleGuard } from '../common/guards/require-school-module.guard';
import { RequireSchoolModule } from '../common/decorators/require-school-module.decorator';
import { RequireModuleActivationGuard } from '../market/guards/require-module-activation.guard';
import { UserRole } from '../types/enums';
import { CreateYillikPlanSubmissionDto } from './dto/create-yillik-plan-submission.dto';
import { UpdateYillikPlanSubmissionDto } from './dto/update-yillik-plan-submission.dto';
import { YillikPlanSubmissionService } from './yillik-plan-submission.service';

@Controller('yillik-plan-icerik/submissions')
export class YillikPlanSubmissionController {
  constructor(private readonly service: YillikPlanSubmissionService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, RequireSchoolModuleGuard, RequireModuleActivationGuard)
  @RequireSchoolModule('document')
  @Roles(UserRole.teacher, UserRole.school_admin)
  async create(@CurrentUser() me: CurrentUserPayload, @Body() dto: CreateYillikPlanSubmissionDto) {
    return this.service.createDraft(me.userId, me.schoolId ?? null, dto);
  }

  @Get('author/me')
  @UseGuards(JwtAuthGuard, RolesGuard, RequireSchoolModuleGuard, RequireModuleActivationGuard)
  @RequireSchoolModule('document')
  @Roles(UserRole.teacher, UserRole.school_admin)
  async listMine(@CurrentUser() me: CurrentUserPayload) {
    return this.service.listMine(me.userId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, RequireSchoolModuleGuard, RequireModuleActivationGuard)
  @RequireSchoolModule('document')
  @Roles(UserRole.teacher, UserRole.school_admin)
  async getOne(@Param('id') id: string, @CurrentUser() me: CurrentUserPayload) {
    return this.service.getOne(id, me.userId, me.role);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, RequireSchoolModuleGuard, RequireModuleActivationGuard)
  @RequireSchoolModule('document')
  @Roles(UserRole.teacher, UserRole.school_admin)
  async updateDraft(@Param('id') id: string, @CurrentUser() me: CurrentUserPayload, @Body() dto: UpdateYillikPlanSubmissionDto) {
    return this.service.updateDraft(id, me.userId, dto);
  }

  @Post(':id/submit')
  @UseGuards(JwtAuthGuard, RolesGuard, RequireSchoolModuleGuard, RequireModuleActivationGuard)
  @RequireSchoolModule('document')
  @Roles(UserRole.teacher, UserRole.school_admin)
  async submit(@Param('id') id: string, @CurrentUser() me: CurrentUserPayload) {
    return this.service.submit(id, me.userId);
  }

  @Post(':id/withdraw')
  @UseGuards(JwtAuthGuard, RolesGuard, RequireSchoolModuleGuard, RequireModuleActivationGuard)
  @RequireSchoolModule('document')
  @Roles(UserRole.teacher, UserRole.school_admin)
  async withdraw(@Param('id') id: string, @CurrentUser() me: CurrentUserPayload) {
    return this.service.withdraw(id, me.userId);
  }
}
