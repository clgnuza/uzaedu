import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { OutcomeSetsService } from './outcome-sets.service';
import { CreateOutcomeSetDto } from './dto/create-outcome-set.dto';
import { UpdateOutcomeSetDto } from './dto/update-outcome-set.dto';
import { ImportFromPlanDto } from './dto/import-from-plan.dto';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { UserRole } from '../types/enums';

@Controller('outcome-sets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OutcomeSetsController {
  constructor(private readonly service: OutcomeSetsService) {}

  @Get('plan-summary')
  @Roles(UserRole.superadmin, UserRole.moderator)
  @RequireModule('outcome_sets')
  async planSummary() {
    const items = await this.service.getPlanSummary();
    return { items };
  }

  @Get()
  @Roles(UserRole.superadmin, UserRole.moderator, UserRole.teacher)
  async list(
    @Query('subject_code') subjectCode?: string,
    @Query('grade') grade?: string,
    @Query('academic_year') academicYear?: string,
  ) {
    const gradeNum = grade ? parseInt(grade, 10) : undefined;
    const items = await this.service.findAll({
      subject_code: subjectCode,
      grade: Number.isFinite(gradeNum) ? gradeNum : undefined,
      academic_year: academicYear,
    });
    return { items };
  }

  @Get(':id')
  @Roles(UserRole.superadmin, UserRole.moderator, UserRole.teacher)
  async getOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(UserRole.superadmin, UserRole.moderator)
  @RequireModule('outcome_sets')
  async create(@Body() dto: CreateOutcomeSetDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.superadmin, UserRole.moderator)
  @RequireModule('outcome_sets')
  async update(@Param('id') id: string, @Body() dto: UpdateOutcomeSetDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.superadmin, UserRole.moderator)
  @RequireModule('outcome_sets')
  async remove(@Param('id') id: string) {
    await this.service.remove(id);
    return { success: true };
  }

  @Post('import-from-plan')
  @Roles(UserRole.superadmin, UserRole.moderator)
  @RequireModule('outcome_sets')
  async importFromPlan(@Body() dto: ImportFromPlanDto) {
    return this.service.importFromPlan(dto);
  }
}
