import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Put,
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
import { BilsemService } from './bilsem.service';
import { BilsemYillikPlanService } from './bilsem-yillik-plan.service';
import { CreateBilsemCalendarItemDto } from './dto/create-calendar-item.dto';
import { UpdateBilsemCalendarItemDto } from './dto/update-calendar-item.dto';
import { PatchBilsemCalendarOverridesDto } from './dto/school-overrides.dto';
import { CreateBilsemCalendarAssignmentDto } from './dto/create-assignment.dto';
import { ReorderBilsemCalendarItemsDto } from './dto/reorder-items.dto';
@Controller('bilsem')
@UseGuards(JwtAuthGuard, RolesGuard, RequireSchoolModuleGuard, RequireModuleActivationGuard)
@RequireSchoolModule('bilsem')
export class BilsemController {
  constructor(
    private readonly service: BilsemService,
    private readonly yillikPlan: BilsemYillikPlanService,
  ) {}

  private getAcademicYear(academicYear: string | undefined): string {
    const y = (academicYear ?? '').trim();
    if (y) return y;
    const year = new Date().getFullYear();
    const month = new Date().getMonth();
    return month < 8 ? `${year - 1}-${year}` : `${year}-${year + 1}`;
  }

  @Get('work-weeks')
  @Roles(UserRole.teacher, UserRole.school_admin)
  async getWorkWeeks(@Query('academic_year') academicYear?: string) {
    return this.service.getWorkWeeksForPlan(this.getAcademicYear(academicYear ?? ''));
  }

  @Get('calendar')
  @Roles(UserRole.teacher, UserRole.school_admin, UserRole.superadmin)
  async getCalendar(
    @Query('academic_year') academicYear: string | undefined,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.service.getCalendarForViewer(this.getAcademicYear(academicYear), payload.schoolId ?? null);
  }

  @Get('calendar/template')
  @Roles(UserRole.superadmin, UserRole.school_admin)
  async getCalendarTemplate(@Query('academic_year') academicYear: string | undefined) {
    return this.service.getCalendarTemplate(this.getAcademicYear(academicYear));
  }

  @Post('calendar/items')
  @Roles(UserRole.superadmin)
  async createCalendarItem(@Body() dto: CreateBilsemCalendarItemDto) {
    return this.service.createCalendarItem(dto);
  }

  @Patch('calendar/items/:id')
  @Roles(UserRole.superadmin)
  async updateCalendarItem(@Param('id') id: string, @Body() dto: UpdateBilsemCalendarItemDto) {
    return this.service.updateCalendarItem(id, dto);
  }

  @Delete('calendar/items/:id')
  @Roles(UserRole.superadmin)
  async deleteCalendarItem(@Param('id') id: string) {
    await this.service.deleteCalendarItem(id);
    return { success: true };
  }

  @Patch('calendar/items/reorder')
  @Roles(UserRole.superadmin)
  async reorderCalendarItems(@Body() dto: ReorderBilsemCalendarItemsDto) {
    await this.service.reorderCalendarItems(dto.item_ids);
    return { success: true };
  }

  @Post('calendar/seed')
  @Roles(UserRole.superadmin)
  async seedCalendar(@Body() body: { academic_year?: string }) {
    return this.service.seedBilsemCalendar(body.academic_year?.trim() ?? '2025-2026');
  }

  @Get('calendar/school-overrides')
  @Roles(UserRole.school_admin)
  async getSchoolOverrides(@CurrentUser() payload: CurrentUserPayload) {
    if (!payload.schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için okul atanmış olmalıdır.' });
    return this.service.getSchoolOverrides(payload.schoolId);
  }

  @Patch('calendar/school-overrides')
  @Roles(UserRole.school_admin)
  async patchSchoolOverrides(
    @CurrentUser() payload: CurrentUserPayload,
    @Body() dto: PatchBilsemCalendarOverridesDto,
  ) {
    if (!payload.schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için okul atanmış olmalıdır.' });
    await this.service.patchSchoolOverrides(payload.schoolId, dto);
    return { success: true };
  }

  @Get('teachers')
  @Roles(UserRole.school_admin)
  async listTeachers(@CurrentUser() payload: CurrentUserPayload) {
    if (!payload.schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için okul atanmış olmalıdır.' });
    return this.service.listSchoolTeachers(payload.schoolId);
  }

  @Get('calendar/my-assignments')
  @Roles(UserRole.teacher)
  async getMyAssignments(
    @Query('academic_year') academicYear: string | undefined,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    if (!payload.schoolId) return [];
    return this.service.getMyAssignments(
      payload.userId,
      payload.schoolId,
      this.getAcademicYear(academicYear),
    );
  }

  @Get('calendar/assignments')
  @Roles(UserRole.school_admin)
  async getAssignments(
    @Query('academic_year') academicYear: string | undefined,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    if (!payload.schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için okul atanmış olmalıdır.' });
    return this.service.getAssignments(payload.schoolId, this.getAcademicYear(academicYear));
  }

  @Post('calendar/assignments')
  @Roles(UserRole.school_admin)
  async createAssignment(
    @CurrentUser() payload: CurrentUserPayload,
    @Body() dto: CreateBilsemCalendarAssignmentDto,
  ) {
    if (!payload.schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için okul atanmış olmalıdır.' });
    return this.service.createAssignment(payload.schoolId, dto, payload.userId);
  }

  @Delete('calendar/assignments/:id')
  @Roles(UserRole.school_admin)
  async deleteAssignment(@Param('id') id: string, @CurrentUser() payload: CurrentUserPayload) {
    if (!payload.schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için okul atanmış olmalıdır.' });
    await this.service.deleteAssignment(payload.schoolId, id);
    return { success: true };
  }

  @Get('yillik-plan/outcome-sets')
  @Roles(UserRole.teacher, UserRole.school_admin, UserRole.superadmin)
  async listBilsemOutcomeSets(
    @Query('subject_code') subjectCode?: string,
    @Query('academic_year') academicYear?: string,
    @Query('grade') gradeStr?: string,
  ) {
    const g = gradeStr ? parseInt(gradeStr, 10) : undefined;
    return this.yillikPlan.listOutcomeSets({
      subject_code: subjectCode,
      academic_year: academicYear,
      grade: g != null && Number.isFinite(g) ? g : undefined,
    });
  }

  @Get('yillik-plan/outcome-sets/:id')
  @Roles(UserRole.teacher, UserRole.school_admin, UserRole.superadmin)
  async getBilsemOutcomeSet(@Param('id') id: string) {
    return this.yillikPlan.getOutcomeSetWithItems(id);
  }

  @Post('yillik-plan/outcome-sets')
  @Roles(UserRole.superadmin)
  async createBilsemOutcomeSet(@Body() body: Record<string, unknown>) {
    return this.yillikPlan.createOutcomeSet(body as any);
  }

  @Patch('yillik-plan/outcome-sets/:id')
  @Roles(UserRole.superadmin)
  async patchBilsemOutcomeSet(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.yillikPlan.updateOutcomeSetMeta(id, body as any);
  }

  @Delete('yillik-plan/outcome-sets/:id')
  @Roles(UserRole.superadmin)
  async deleteBilsemOutcomeSet(@Param('id') id: string) {
    await this.yillikPlan.deleteOutcomeSet(id);
    return { success: true };
  }

  @Put('yillik-plan/outcome-sets/:id/items')
  @Roles(UserRole.superadmin)
  async putBilsemOutcomeItems(@Param('id') id: string, @Body() body: { items?: unknown[] }) {
    const items = (body.items ?? []) as any[];
    return this.yillikPlan.upsertItems(id, items);
  }
}
