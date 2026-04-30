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
import { YillikPlanIcerikService } from '../yillik-plan-icerik/yillik-plan-icerik.service';
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
    private readonly yillikPlanIcerikService: YillikPlanIcerikService,
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
    @CurrentUser() me: CurrentUserPayload,
    @Query('subject_code') subjectCode?: string,
    @Query('academic_year') academicYear?: string,
    @Query('grade') gradeStr?: string,
  ) {
    const g = gradeStr ? parseInt(gradeStr, 10) : undefined;
    return this.yillikPlan.listOutcomeSets({
      subject_code: subjectCode,
      academic_year: academicYear,
      grade: g != null && Number.isFinite(g) ? g : undefined,
      viewerUserId: me.userId,
      viewerRole: me.role as UserRole,
    });
  }

  @Get('yillik-plan/plan-summaries')
  @Roles(UserRole.teacher, UserRole.school_admin, UserRole.superadmin)
  async listBilsemPlanSummaries() {
    const rows = await this.yillikPlanIcerikService.findSummary('bilsem');
    return {
      items: rows.filter((x) => String(x.ana_grup ?? '').trim()),
    };
  }

  @Get('yillik-plan/plan-rows')
  @Roles(UserRole.teacher, UserRole.school_admin, UserRole.superadmin)
  async listBilsemPlanRows(
    @Query('subject_code') subjectCode?: string,
    @Query('academic_year') academicYear?: string,
    @Query('ana_grup') anaGrup?: string,
    @Query('alt_grup') altGrup?: string,
  ) {
    const ay = String(academicYear ?? '').trim();
    const items = await this.yillikPlanIcerikService.findAll({
      subject_code: String(subjectCode ?? '').trim(),
      academic_year: ay,
      curriculum_model: 'bilsem',
      ana_grup: String(anaGrup ?? '').trim(),
      ...(altGrup != null ? { alt_grup: String(altGrup).trim() } : {}),
    });
    const weekMeta = new Map<
      number,
      { haftaLabel?: string | null; weekStart?: string | null; weekEnd?: string | null }
    >();
    if (ay) {
      const weeks = await this.service.getWorkWeeksForPlan(ay);
      for (const w of weeks) {
        if (!Number.isFinite(Number(w.weekOrder))) continue;
        weekMeta.set(Number(w.weekOrder), {
          haftaLabel: `${Number(w.weekOrder)}. Hafta`,
          weekStart: w.weekStart ?? null,
          weekEnd: w.weekEnd ?? null,
        });
      }
    }
    this.yillikPlanIcerikService.attachBilsemPuyDisplayDefaults(items);
    return {
      items: items.map((r) => ({
        id: r.id,
        week_order: r.weekOrder,
        hafta_label: weekMeta.get(r.weekOrder)?.haftaLabel ?? null,
        week_start: weekMeta.get(r.weekOrder)?.weekStart ?? null,
        week_end: weekMeta.get(r.weekOrder)?.weekEnd ?? null,
        unite: r.unite,
        konu: r.konu,
        kazanimlar: r.kazanimlar,
        ders_saati: r.dersSaati,
        surec_bilesenleri: r.surecBilesenleri,
        olcme_degerlendirme: r.olcmeDegerlendirme,
        sosyal_duygusal: r.sosyalDuygusal,
        degerler: r.degerler,
        okuryazarlik_becerileri: r.okuryazarlikBecerileri,
        belirli_gun_haftalar: r.belirliGunHaftalar,
        zenginlestirme: r.zenginlestirme,
        okul_temelli_planlama: r.okulTemelliPlanlama,
      })),
    };
  }

  @Get('yillik-plan/outcome-sets/:id')
  @Roles(UserRole.teacher, UserRole.school_admin, UserRole.superadmin)
  async getBilsemOutcomeSet(@Param('id') id: string, @CurrentUser() me: CurrentUserPayload) {
    return this.yillikPlan.getOutcomeSetWithItems(id, { userId: me.userId, role: me.role as UserRole });
  }

  @Post('yillik-plan/outcome-sets')
  @Roles(UserRole.superadmin)
  async createBilsemOutcomeSet(@Body() body: Record<string, unknown>) {
    const b = { ...body } as Record<string, unknown> & { owner_user_id?: unknown };
    delete b.owner_user_id;
    return this.yillikPlan.createOutcomeSet(b as any);
  }

  @Patch('yillik-plan/outcome-sets/:id')
  @Roles(UserRole.teacher, UserRole.school_admin, UserRole.superadmin)
  async patchBilsemOutcomeSet(
    @Param('id') id: string,
    @CurrentUser() me: CurrentUserPayload,
    @Body() body: Record<string, unknown>,
  ) {
    return this.yillikPlan.updateOutcomeSetMeta(id, body as any, { userId: me.userId, role: me.role as UserRole });
  }

  @Delete('yillik-plan/outcome-sets/:id')
  @Roles(UserRole.teacher, UserRole.school_admin, UserRole.superadmin)
  async deleteBilsemOutcomeSet(@Param('id') id: string, @CurrentUser() me: CurrentUserPayload) {
    await this.yillikPlan.deleteOutcomeSet(id, { userId: me.userId, role: me.role as UserRole });
    return { success: true };
  }

  @Put('yillik-plan/outcome-sets/:id/items')
  @Roles(UserRole.teacher, UserRole.school_admin, UserRole.superadmin)
  async putBilsemOutcomeItems(
    @Param('id') id: string,
    @CurrentUser() me: CurrentUserPayload,
    @Body() body: { items?: unknown[] },
  ) {
    const items = (body.items ?? []) as any[];
    return this.yillikPlan.upsertItems(id, items, { userId: me.userId, role: me.role as UserRole });
  }

  @Post('yillik-plan/outcome-sets/import-from-yillik-plan')
  @Roles(UserRole.superadmin)
  async importBilsemOutcomeSetFromYillikPlan(
    @Body()
    body: {
      subject_code?: string;
      subject_label?: string;
      academic_year?: string;
      ana_grup?: string;
      alt_grup?: string | null;
    },
  ) {
    return this.yillikPlan.syncOutcomeSetFromBilsemYillikPlan({
      subject_code: String(body.subject_code ?? ''),
      subject_label: body.subject_label,
      academic_year: String(body.academic_year ?? ''),
      ana_grup: String(body.ana_grup ?? ''),
      alt_grup: body.alt_grup ?? undefined,
    });
  }
}
