import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, ForbiddenException, BadRequestException } from '@nestjs/common';
import { RawBody } from '../common/decorators/raw-body.decorator';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { RequireSchoolModuleGuard } from '../common/guards/require-school-module.guard';
import { RequireSchoolModule } from '../common/decorators/require-school-module.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { UserRole } from '../types/enums';
import { DutyService } from './duty.service';
import { CreateDutyPlanDto } from './dto/create-duty-plan.dto';
import { UpdateDutySlotDto } from './dto/update-duty-slot.dto';
import { DutySlotInputDto } from './dto/create-duty-plan.dto';
import { ReassignSlotDto } from './dto/reassign-slot.dto';
import { CreateSwapRequestDto } from './dto/create-swap-request.dto';
import { RespondSwapDto } from './dto/respond-swap.dto';
@Controller('duty')
@UseGuards(JwtAuthGuard, RequireSchoolModuleGuard)
@RequireSchoolModule('duty')
export class DutyController {
  constructor(private readonly service: DutyService) {}

  private localYmd(d = new Date()): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /** Plan listesi – school_admin: tüm planlar, teacher: kendi nöbetleri */
  @Get('plans')
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin, UserRole.teacher)
  async listPlans(@CurrentUser() payload: CurrentUserPayload) {
    const schoolId = payload.role === UserRole.teacher ? payload.schoolId : payload.schoolId;
    return this.service.listPlans(schoolId, payload.role as UserRole);
  }

  /** Tarih aralığı nöbet slotları – ?from=YYYY-MM-DD&to=YYYY-MM-DD (takvim görünümleri) */
  @Get('daily-range')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin, UserRole.teacher)
  async getDailyRange(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('shift') shift: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    const f = from ?? this.localYmd();
    const t = to ?? f;
    return this.service.getSlotsForDateRange(
      payload.schoolId,
      f,
      t,
      payload.role as UserRole,
      payload.userId,
      shift || undefined,
    );
  }

  /** Günlük nöbet listesi – ?date=YYYY-MM-DD */
  @Get('daily')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin, UserRole.teacher)
  async getDaily(
    @Query('date') date: string,
    @Query('shift') shift: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    const d = date ?? this.localYmd();
    const schoolId = payload.schoolId;
    return this.service.getDailyRoster(
      schoolId ?? null,
      d,
      payload.role as UserRole,
      payload.userId,
      shift || undefined,
    );
  }

  /** Tek plan detayı */
  @Get('plans/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin, UserRole.teacher)
  async getPlan(
    @Param('id') id: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.service.getPlanById(id, payload.schoolId, payload.role as UserRole, payload.userId);
  }

  /** Nöbet dağıtım raporu (öğretmen × hafta içi gün) – school_admin */
  @Get('plans/:id/distribution')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin)
  async getPlanDistribution(
    @Param('id') id: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.service.getPlanDistribution(id, payload.schoolId ?? null);
  }

  /** Bu plana ait değişiklik logları – school_admin */
  @Get('plans/:id/logs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin)
  async listPlanLogs(
    @Param('id') id: string,
    @Query('limit') limit: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    const n = limit ? parseInt(limit, 10) : 25;
    return this.service.listLogsForPlan(id, payload.schoolId ?? null, {
      limit: Number.isFinite(n) ? n : 25,
    });
  }

  /** Yeni plan oluştur (JSON ile slotlar) – school_admin */
  @Post('plans')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin)
  async createPlan(
    @Body() dto: CreateDutyPlanDto,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    if (!payload.schoolId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    }
    return this.service.createPlan(payload.schoolId, payload.userId, dto);
  }

  /** Slot güncelle – school_admin (el ile düzenleme) */
  @Patch('slots/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin)
  async updateSlot(
    @Param('id') id: string,
    @Body() dto: UpdateDutySlotDto,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.service.updateSlot(id, payload.schoolId ?? null, dto, payload.userId);
  }

  /** Plana slot ekle – school_admin */
  @Post('plans/:id/slots')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin)
  async addSlotToPlan(
    @Param('id') id: string,
    @Body() dto: DutySlotInputDto,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.service.addSlotToPlan(id, payload.schoolId ?? null, dto, payload.userId);
  }

  /** Slot sil – school_admin */
  @Delete('slots/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin)
  async deleteSlot(
    @Param('id') id: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.service.deleteSlot(id, payload.schoolId ?? null, payload.userId);
  }

  /** Plan yayınla – school_admin */
  @Post('plans/:id/publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin)
  async publishPlan(
    @Param('id') id: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.service.publishPlan(id, payload.schoolId ?? null, payload.userId);
  }

  /** Plan soft delete – school_admin (istatistikler korunur) */
  @Post('plans/:id/soft-delete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin)
  async softDeletePlan(
    @Param('id') id: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.service.softDeletePlan(id, payload.schoolId ?? null);
  }

  /** Planları toplu soft delete – school_admin */
  @Post('plans/bulk-delete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin)
  async softDeletePlansBulk(
    @Body() body: { plan_ids: string[] },
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    const ids = Array.isArray(body?.plan_ids) ? body.plan_ids : [];
    if (ids.length === 0) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'plan_ids gereklidir.' });
    return this.service.softDeletePlansBulk(ids, payload.schoolId ?? null);
  }

  /** Yerine görevlendir – school_admin */
  @Post('reassign')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin)
  async reassign(
    @Body() dto: ReassignSlotDto,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.service.reassignSlot(
      dto.duty_slot_id,
      dto.new_user_id,
      payload.schoolId ?? null,
      payload.userId,
    );
  }

  /** Gelmeyen işaretle – school_admin (absent_type: raporlu|izinli|gelmeyen) */
  @Post('mark-absent')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin)
  async markAbsent(
    @Body() body: { duty_slot_id: string; absent_type?: 'raporlu' | 'izinli' | 'gelmeyen' },
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.service.markAbsent(
      body.duty_slot_id,
      payload.schoolId ?? null,
      payload.userId,
      body.absent_type,
    );
  }

  /** Devamsızlık ekle – school_admin (raporlu/izinli/gelmeyen) */
  @Post('absences')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin)
  async createAbsence(
    @Body() dto: { user_id: string; date_from: string; date_to: string; absence_type: 'raporlu' | 'izinli' | 'gelmeyen'; note?: string },
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.service.createAbsence(payload.schoolId ?? null, payload.userId, dto);
  }

  /** Devamsızlıkları listele – ?from=YYYY-MM-DD&to=YYYY-MM-DD */
  @Get('absences')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin)
  async listAbsences(
    @Query('from') from: string,
    @Query('to') to: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.service.listAbsences(payload.schoolId ?? null, from, to);
  }

  /** Devamsızlık sil – school_admin */
  @Delete('absences/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin)
  async deleteAbsence(
    @Param('id') id: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.service.deleteAbsence(id, payload.schoolId ?? null);
  }

  /** Günlük tablodan işaretlenen slotlar – ?from=YYYY-MM-DD&to=YYYY-MM-DD (Devamsızlık sekmesinde) */
  @Get('absent-slots')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin)
  async getAbsentSlots(
    @Query('from') from: string,
    @Query('to') to: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    if (!from || !to) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'from ve to parametreleri zorunludur.' });
    return this.service.getAbsentSlotsOnly(payload.schoolId ?? null, from, to);
  }

  /** Slot devamsızlık işaretini kaldır – günlük tablodan işaretlenenler için */
  @Post('slots/:id/clear-absent')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin)
  async clearSlotAbsent(
    @Param('id') id: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.service.clearSlotAbsent(id, payload.schoolId ?? null);
  }

  /** Bekleyen coverage sayısı – nav badge (school_admin), ?from=&to= */
  @Get('pending-coverage-count')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin)
  async getPendingCoverageCount(
    @Query('from') from: string,
    @Query('to') to: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    const count = await this.service.getPendingCoverageCount(payload.schoolId ?? null, from, to);
    return { count };
  }

  /** Ek ders puantaj için devamsızlık özeti */
  @Get('absences-for-ek-ders')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin)
  async getAbsencesForEkDers(
    @Query('from') from: string,
    @Query('to') to: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    if (!from || !to) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'from ve to parametreleri zorunludur.' });
    return this.service.getAbsencesForEkDers(payload.schoolId ?? null, from, to);
  }

  /** Otomatik görevlendirme – tek tuşla plan oluştur */
  @Post('plans/auto-generate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin)
  async autoGeneratePlan(
    @Body()
    dto: {
      period_start: string;
      period_end: string;
      slots_per_day?: number;
      area_names?: string[];
      version?: string;
      shifts?: ('morning' | 'afternoon')[] | string[];
      /** Öğretmene haftada kaç gün nöbet (1 veya 2); her hafta aynı gün(ler) */
      duty_days_per_week?: 1 | 2;
      max_per_week?: number;
      prevent_consecutive_days?: boolean;
      respect_preferences?: boolean;
      enable_weekday_balance?: boolean;
      prefer_fewer_lessons_day?: boolean;
      same_day_each_week?: boolean;
      max_per_month?: number;
      min_days_between?: number;
      /** Dönerli liste: İlk hafta şablon, sonraki haftalarda nöbet yerleri bir kaydırılır (Excel benzeri) */
      rotate_area_by_week?: boolean;
      /** Bu planda eşit dağılım (varsayılan true); false = geçmiş dönem görevlendirme ağırlığına göre */
      equal_plan_totals?: boolean;
    },
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    const slotsPerDay =
      typeof dto.slots_per_day === 'number' && Number.isFinite(dto.slots_per_day) && dto.slots_per_day > 0
        ? dto.slots_per_day
        : 3;
    return this.service.autoGeneratePlan(payload.schoolId ?? null, payload.userId, {
      ...dto,
      slots_per_day: slotsPerDay,
    });
  }

  /** Öğretmen başına nöbet sayısı – ?from=YYYY-MM-DD&to=YYYY-MM-DD */
  @Get('summary')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin, UserRole.teacher)
  async getSummary(
    @Query('from') from: string,
    @Query('to') to: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.service.getSummary(
      payload.schoolId,
      from || undefined,
      to || undefined,
      payload.role as UserRole,
      payload.userId,
    );
  }

  /** Ders saati bazlı görevlendirmeler – ?from=YYYY-MM-DD&to=YYYY-MM-DD (Görevlendirmeler sayfası) */
  @Get('coverages')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin)
  async getCoverageAssignments(
    @Query('from') from: string,
    @Query('to') to: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    if (!from || !to) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'from ve to parametreleri zorunludur.' });
    return this.service.getCoverageAssignments(payload.schoolId ?? null, from, to);
  }

  /** Yerine görevlendirilmiş nöbetler – ?from=YYYY-MM-DD&to=YYYY-MM-DD – school_admin */
  @Get('reassigned')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin)
  async getReassigned(
    @Query('from') from: string,
    @Query('to') to: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.service.getReassignedSlots(
      payload.schoolId ?? null,
      from || undefined,
      to || undefined,
    );
  }

  /** Değişiklik logları – school_admin */
  @Get('logs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin)
  async listLogs(
    @Query('limit') limit: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('action') action: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    const n = limit ? parseInt(limit, 10) : 50;
    return this.service.listLogs(payload.schoolId ?? null, {
      limit: Number.isFinite(n) ? n : 50,
      from: from || undefined,
      to: to || undefined,
      action: action || undefined,
    });
  }

  /** Yerine görevlendirme önerisi – o gün nöbetçilerden boş saati olanlar (school_admin) */
  @Get('suggest-replacement')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin)
  async suggestReplacement(
    @Query('duty_slot_id') dutySlotId: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    if (!dutySlotId) return [];
    return this.service.suggestReplacement(payload.schoolId ?? null, dutySlotId);
  }

  /**
   * Okuldaki öğretmenler.
   * ?includeExempt=true → muaf öğretmenler de listelenir (muafiyet yönetim ekranı için).
   * Varsayılan: muaf öğretmenler hariç (takas dropdown vb.).
   */
  @Get('teachers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin, UserRole.teacher)
  async listSchoolTeachers(
    @Query('includeExempt') includeExempt: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    const excludeExempt = includeExempt !== 'true';
    return this.service.listSchoolTeachers(payload.schoolId ?? null, excludeExempt, {
      id: payload.userId,
      role: payload.role as UserRole,
    });
  }

  /** Belirli tarihte nöbetçi arkadaşlar – teacher + admin erişebilir */
  @Get('partners')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin, UserRole.teacher)
  async getDutyPartners(
    @Query('date') date: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    const d = date ?? new Date().toISOString().slice(0, 10);
    return this.service.getDutyPartners(payload.schoolId ?? null, d, payload.userId);
  }

  /** Öğretmen nöbet muafiyetini güncelle – school_admin */
  @Patch('teachers/:id/exempt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin)
  async setTeacherExempt(
    @Param('id') id: string,
    @Body() body: { duty_exempt: boolean; duty_exempt_reason?: string | null },
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.service.setTeacherExempt(
      id,
      payload.schoolId ?? null,
      body.duty_exempt,
      body.duty_exempt_reason ?? null,
      payload.userId,
    );
  }

  /** Öğretmen özellikleri – Görev Devri ve Tercihlerim açık mı (öğretmen + admin) */
  @Get('teacher-features')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin, UserRole.teacher)
  async getTeacherFeatures(@CurrentUser() payload: CurrentUserPayload) {
    return this.service.getTeacherFeatures(payload.schoolId ?? null);
  }

  /** Öğretmen özellikleri güncelle – school_admin */
  @Patch('teacher-features')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin)
  async updateTeacherFeatures(
    @Body() body: { swap_enabled?: boolean; preferences_enabled?: boolean },
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.service.updateTeacherFeatures(payload.schoolId ?? null, body);
  }

  /** Tebliğ şablonları – GET (school_admin) */
  @Get('teblig-templates')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin)
  async getTebligTemplates(@CurrentUser() payload: CurrentUserPayload) {
    return this.service.getTebligTemplates(payload.schoolId ?? null);
  }

  /** Tebliğ şablonları – PATCH (school_admin) */
  @Patch('teblig-templates')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin)
  async updateTebligTemplates(
    @Body()
    body: {
      duty_template?: string | null;
      coverage_template?: string | null;
      bos_ders_paragraf?: string | null;
      bos_ders_konu?: string | null;
      principal_name?: string | null;
      deputy_principal_name?: string | null;
      haftalik_baslik?: string | null;
      haftalik_duty_duties_text?: string | null;
    },
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.service.updateTebligTemplates(payload.schoolId ?? null, body);
  }

  /** Okul varsayılan nöbet saatleri + ders saatleri – GET (teacher okur, school_admin okur/yazar) */
  @Get('school-default-times')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin, UserRole.teacher)
  async getSchoolDefaultTimes(@CurrentUser() payload: CurrentUserPayload) {
    return this.service.getSchoolDefaultTimes(payload.schoolId ?? null);
  }

  /** Okul varsayılan nöbet saatleri + ders saatleri – PATCH */
  @Patch('school-default-times')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin)
  async updateSchoolDefaultTimes(
    @Body()
    body: {
      duty_education_mode?: 'single' | 'double' | null;
      duty_max_lessons?: number | null;
      duty_start_time?: string | null;
      duty_end_time?: string | null;
      lesson_schedule?: { lesson_num: number; start_time: string; end_time: string }[] | null;
      duty_start_time_pm?: string | null;
      duty_end_time_pm?: string | null;
      lesson_schedule_pm?: { lesson_num: number; start_time: string; end_time: string }[] | null;
      lesson_schedule_weekend?: { lesson_num: number; start_time: string; end_time: string }[] | null;
      lesson_schedule_weekend_pm?: { lesson_num: number; start_time: string; end_time: string }[] | null;
      principal_name?: string | null;
      district?: string | null;
    },
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.service.updateSchoolDefaultTimes(
      payload.schoolId ?? null,
      body,
    );
  }

  /** Nöbet yerleri listesi */
  @Get('areas')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin, UserRole.teacher)
  async listAreas(@CurrentUser() payload: CurrentUserPayload) {
    return this.service.listAreas(payload.schoolId);
  }

  /** Nöbet yeri ekle – school_admin (slots_required, sort_order = öncelik, düşük = önce atanır) */
  @Post('areas')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin)
  async createArea(
    @Body() body: { name: string; slots_required?: number; sort_order?: number },
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    const slotsRequired = typeof body.slots_required === 'number' && body.slots_required > 0 ? body.slots_required : 1;
    const sortOrder = typeof body.sort_order === 'number' ? body.sort_order : undefined;
    return this.service.createArea(payload.schoolId ?? null, body.name ?? '', slotsRequired, sortOrder);
  }

  /** Nöbet yeri güncelle – school_admin (name, sort_order, slots_required) */
  @Patch('areas/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin)
  async updateArea(
    @Param('id') id: string,
    @Body() body: { name?: string; sort_order?: number; slots_required?: number },
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.service.updateArea(id, payload.schoolId ?? null, body);
  }

  /** Nöbet yeri sil – school_admin */
  @Delete('areas/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin)
  async deleteArea(
    @Param('id') id: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.service.deleteArea(id, payload.schoolId ?? null);
  }

  /** Nöbet takas / değişim talebi oluştur – teacher */
  @Post('swap-requests')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher)
  async createSwapRequest(
    @Body() dto: CreateSwapRequestDto,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.service.createSwapRequest(
      dto.duty_slot_id,
      dto.proposed_user_id ?? null,
      payload.schoolId ?? null,
      payload.userId,
      dto.request_type ?? 'swap',
      dto.coverage_id ?? null,
    );
  }

  /** Takas talebini öğretmen B olarak onayla/reddet – teacher */
  @Post('swap-requests/:id/teacher-respond')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher)
  async teacherRespondSwap(
    @Param('id') id: string,
    @Body() body: { action: 'approved' | 'rejected' },
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    if (!body.action || !['approved', 'rejected'].includes(body.action)) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'action: approved veya rejected olmalı.' });
    }
    return this.service.teacherRespondSwap(id, payload.userId, payload.schoolId ?? null, body.action);
  }

  /** Takas taleplerini listele – teacher: kendi, school_admin: okul geneli */
  @Get('swap-requests')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin, UserRole.teacher)
  async listSwapRequests(@CurrentUser() payload: CurrentUserPayload) {
    return this.service.listSwapRequests(
      payload.schoolId ?? null,
      payload.role as UserRole,
      payload.userId,
    );
  }

  /** Takas talebini iptal et – teacher (sadece kendi beklemedeki talebi) */
  @Delete('swap-requests/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async cancelSwapRequest(
    @Param('id') id: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.service.cancelSwapRequest(
      id,
      payload.schoolId ?? null,
      payload.userId,
      payload.role as UserRole,
    );
  }

  /** Takas talebini onayla/reddet – school_admin */
  @Post('swap-requests/:id/respond')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin)
  async respondSwapRequest(
    @Param('id') id: string,
    @Body() dto: RespondSwapDto,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.service.respondSwapRequest(
      id,
      dto.status,
      dto.admin_note,
      payload.schoolId ?? null,
      payload.userId,
      dto.proposed_user_id,
    );
  }

  /** Onaylanmış takası/değişimi geri al – school_admin */
  @Post('swap-requests/:id/revert')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin)
  async revertApprovedSwapRequest(
    @Param('id') id: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.service.revertApprovedSwapRequest(id, payload.schoolId ?? null, payload.userId);
  }

  /** Nöbet tercihi ekle – teacher (tek gün veya her hafta) – RawBody: ValidationPipe atlanır */
  @Post('preferences')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher)
  async createPreference(
    @RawBody() body: Record<string, unknown>,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    const status = body?.status;
    const validStatuses = ['available', 'unavailable', 'prefer'] as const;
    if (!status || typeof status !== 'string' || !validStatuses.includes(status as (typeof validStatuses)[number])) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'status: available, unavailable veya prefer olmalı.' });
    }
    return this.service.createPreference(
      {
        date: typeof body?.date === 'string' ? body.date : undefined,
        day_of_week: Array.isArray(body?.day_of_week) ? body.day_of_week : undefined,
        period_from: typeof body?.period_from === 'string' ? body.period_from : undefined,
        period_to: typeof body?.period_to === 'string' ? body.period_to : undefined,
        status: status as 'available' | 'unavailable' | 'prefer',
        note: typeof body?.note === 'string' ? body.note : undefined,
      },
      payload.schoolId ?? null,
      payload.userId,
    );
  }

  /** Tercih dikkate alındı – school_admin */
  @Patch('preferences/:id/confirm')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin)
  async confirmPreference(
    @Param('id') id: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.service.confirmPreference(id, payload.schoolId ?? null, payload.userId);
  }

  /** Tercih onayını geri al – school_admin */
  @Patch('preferences/:id/unconfirm')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin)
  async unconfirmPreference(
    @Param('id') id: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.service.unconfirmPreference(id, payload.schoolId ?? null);
  }

  /** Nöbet tercihlerini listele – ?from=YYYY-MM-DD&to=YYYY-MM-DD */
  @Get('preferences')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin, UserRole.teacher)
  async listPreferences(
    @Query('from') from: string,
    @Query('to') to: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.service.listPreferences(
      payload.schoolId ?? null,
      payload.role as UserRole,
      payload.userId,
      from || undefined,
      to || undefined,
    );
  }

  /** Nöbet tercihi sil – teacher */
  @Delete('preferences/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher)
  async deletePreference(
    @Param('id') id: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.service.deletePreference(id, payload.schoolId ?? null, payload.userId);
  }

  // ─── DERS SAATİ BAZLI COVERAGE ───────────────────────────────────────────────

  /**
   * Slot için ders saati bazlı coverage durumunu getir.
   * Her ders saatinde kim atanmış + öneri listesi.
   * GET /duty/coverage?duty_slot_id=…
   */
  @Get('coverage')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin)
  async getCoverageStatus(
    @Query('duty_slot_id') dutySlotId: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    if (!dutySlotId) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'duty_slot_id gereklidir.' });
    return this.service.getCoverageStatus(dutySlotId, payload.schoolId ?? null);
  }

  /**
   * Belirli bir ders saatine öğretmen ata.
   * POST /duty/coverage/assign
   * Body: { duty_slot_id, lesson_num, user_id }
   */
  @Post('coverage/assign')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin)
  async assignCoverage(
    @Body() body: { duty_slot_id: string; lesson_num: number; user_id: string },
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    if (!body.duty_slot_id || !body.lesson_num || !body.user_id) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'duty_slot_id, lesson_num, user_id zorunludur.' });
    }
    return this.service.assignCoverage(
      body.duty_slot_id,
      body.lesson_num,
      body.user_id,
      payload.schoolId ?? null,
      payload.userId,
    );
  }

  /**
   * Tüm atanmamış ders saatlerini otomatik ata.
   * POST /duty/coverage/auto-assign
   * Body: { duty_slot_id }
   */
  @Post('coverage/auto-assign')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin)
  async autoAssignCoverages(
    @Body() body: { duty_slot_id: string },
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    if (!body.duty_slot_id) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'duty_slot_id zorunludur.' });
    return this.service.autoAssignCoverages(body.duty_slot_id, payload.schoolId ?? null, payload.userId);
  }

  /**
   * Coverage atamasını kaldır (öğretmeni sıfırla).
   * DELETE /duty/coverage/:id
   */
  @Delete('coverage/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin)
  async removeCoverage(
    @Param('id') id: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.service.removeCoverage(id, payload.schoolId ?? null);
  }

  /**
   * Son 24 saatteki bir log kaydını geri al.
   * POST /duty/undo/:log_id
   */
  @Post('undo/:log_id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin)
  async undoAction(
    @Param('log_id') logId: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.service.undoAction(logId, payload.schoolId ?? null, payload.userId);
  }

  /**
   * Belirli tarihte görevli öğretmenlere toplu bildirim gönder (el ile tetiklenen).
   * POST /duty/notify-daily?date=YYYY-MM-DD
   */
  @Post('notify-daily')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin)
  async sendDailyNotifications(
    @Query('date') date: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    const d = date ?? new Date().toISOString().slice(0, 10);
    return this.service.sendDailyNotifications(payload.schoolId ?? null, d);
  }

  /**
   * Devamsızlık kaydı için öğretmenin ders programını döndür (boş ders görünümü).
   * GET /duty/absences/:id/class-schedule
   */
  @Get('absences/:id/class-schedule')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin)
  async getAbsenceClassSchedule(
    @Param('id') id: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.service.getAbsenceClassSchedule(id, payload.schoolId ?? null);
  }

  /**
   * Tarih veya tarih aralığındaki coverage kayıtları.
   * GET /duty/coverage-by-date?date=YYYY-MM-DD
   * GET /duty/coverage-by-date?from=YYYY-MM-DD&to=YYYY-MM-DD (ders görevi değişimi için)
   */
  @Get('coverage-by-date')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin, UserRole.teacher)
  async getCoverageByDate(
    @Query('date') date: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    if (from && to) {
      return this.service.getCoveragesForDateRange(payload.schoolId ?? null, from, to);
    }
    if (!date) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'date veya from+to gereklidir.' });
    return this.service.getCoveragesForDate(payload.schoolId ?? null, date);
  }

  /**
   * Nöbetçi Öğretmen Boş Ders Görevlendirme formatı.
   * Gün seçilince o güne ait gelmeyen ve yerine görevlendirilen öğretmenleri döner.
   * GET /duty/bos-ders-teblig?date=YYYY-MM-DD
   */
  @Get('bos-ders-teblig')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin, UserRole.teacher)
  async getBosDersTeblig(
    @Query('date') date: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    if (!date) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'date gereklidir.' });
    return this.service.getBosDersTeblig(payload.schoolId ?? null, date);
  }

  /**
   * Haftalık nöbet çizelgesi – tablo formatı yazdırma için.
   * GET /duty/haftalik-cizelge?weekStart=YYYY-MM-DD
   */
  @Get('haftalik-cizelge')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin, UserRole.teacher)
  async getHaftalikCizelge(
    @Query('weekStart') weekStart: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    if (!weekStart) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'weekStart gereklidir.' });
    return this.service.getHaftalikCizelge(payload.schoolId ?? null, weekStart);
  }

  /**
   * Aylık nöbet çizelgesi – ay/yıl bazlı tablo (Sabah/Öğlen vardiyalı).
   * GET /duty/aylik-cizelge?month=9&year=2025
   */
  @Get('aylik-cizelge')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin, UserRole.teacher)
  async getAylikCizelge(
    @Query('month') monthStr: string,
    @Query('year') yearStr: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    const month = parseInt(monthStr, 10);
    const year = parseInt(yearStr, 10);
    if (!monthStr || !yearStr || isNaN(month) || isNaN(year)) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'month ve year gereklidir.' });
    }
    return this.service.getAylikCizelge(payload.schoolId ?? null, month, year);
  }
}
