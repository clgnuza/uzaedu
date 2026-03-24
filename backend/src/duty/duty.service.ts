import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { DutyPlan } from './entities/duty-plan.entity';
import { DutySlot } from './entities/duty-slot.entity';
import { DutyLog } from './entities/duty-log.entity';
import { DutyArea } from './entities/duty-area.entity';
import { DutySwapRequest } from './entities/duty-swap-request.entity';
import { DutyPreference } from './entities/duty-preference.entity';
import { DutyAbsence } from './entities/duty-absence.entity';
import { DutyCoverage } from './entities/duty-coverage.entity';
import { User } from '../users/entities/user.entity';
import { School } from '../schools/entities/school.entity';
import { WorkCalendar } from '../work-calendar/entities/work-calendar.entity';
import { CreateDutyPlanDto } from './dto/create-duty-plan.dto';
import { UpdateDutySlotDto } from './dto/update-duty-slot.dto';
import { DutySlotInputDto } from './dto/create-duty-plan.dto';
import { UserRole } from '../types/enums';
import { maskTeacherDisplayName } from '../common/utils/teacher-display-name';
import { NotificationsService } from '../notifications/notifications.service';
import { TeacherTimetableService } from '../teacher-timetable/teacher-timetable.service';

@Injectable()
export class DutyService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(DutyPlan)
    private readonly planRepo: Repository<DutyPlan>,
    @InjectRepository(DutySlot)
    private readonly slotRepo: Repository<DutySlot>,
    @InjectRepository(DutyLog)
    private readonly logRepo: Repository<DutyLog>,
    @InjectRepository(DutyArea)
    private readonly areaRepo: Repository<DutyArea>,
    @InjectRepository(DutySwapRequest)
    private readonly swapRepo: Repository<DutySwapRequest>,
    @InjectRepository(DutyPreference)
    private readonly prefRepo: Repository<DutyPreference>,
    @InjectRepository(DutyAbsence)
    private readonly absenceRepo: Repository<DutyAbsence>,
    @InjectRepository(DutyCoverage)
    private readonly coverageRepo: Repository<DutyCoverage>,
    @InjectRepository(School)
    private readonly schoolRepo: Repository<School>,
    @InjectRepository(WorkCalendar)
    private readonly workCalendarRepo: Repository<WorkCalendar>,
    private readonly notificationsService: NotificationsService,
    private readonly timetableService: TeacherTimetableService,
  ) {}

  async listPlans(schoolId: string | null, role: UserRole) {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    const qb = this.planRepo
      .createQueryBuilder('p')
      .where('p.school_id = :schoolId', { schoolId })
      .andWhere('p.deleted_at IS NULL')
      .orderBy('p.created_at', 'DESC');
    // Teacher rolü taslak planları göremez
    if (role === UserRole.teacher) {
      qb.andWhere("p.status != 'draft'");
    }
    return qb.getMany();
  }

  async getPlanById(id: string, schoolId: string | null, role: UserRole, userId?: string) {
    const plan = await this.planRepo.findOne({
      where: { id, deleted_at: IsNull() },
      relations: ['slots', 'slots.user'],
    });
    if (!plan) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Plan bulunamadı.' });
    if (plan.school_id !== schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu plana erişim yetkiniz yok.' });
    if (role === UserRole.teacher && userId && plan.slots) {
      plan.slots = plan.slots.filter((s) => s.user_id === userId);
    }
    // Nöbet kayıtlarını tarih → vardiya → alan sırasına göre sırala (anlaşılır liste)
    if (plan.slots?.length) {
      plan.slots = plan.slots.slice().sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        const shA = (a.shift ?? 'morning') === 'afternoon' ? 1 : 0;
        const shB = (b.shift ?? 'morning') === 'afternoon' ? 1 : 0;
        if (shA !== shB) return shA - shB;
        return (a.area_name ?? '').localeCompare(b.area_name ?? '');
      });
    }
    return plan;
  }

  async getSlotsForDate(
    schoolId: string | null,
    date: string,
    role: UserRole,
    userId?: string,
    shift?: string,
  ) {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    const qb = this.slotRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.user', 'u')
      .leftJoinAndSelect('s.duty_plan', 'p')
      .where('p.school_id = :schoolId', { schoolId })
      .andWhere('p.status = :status', { status: 'published' })
      .andWhere('p.deleted_at IS NULL')
      .andWhere('s.deleted_at IS NULL')
      .andWhere('s.date = :date', { date });
    if (shift === 'morning' || shift === 'afternoon') {
      qb.andWhere('s.shift = :shift', { shift });
    }
    if (role === UserRole.teacher && userId) {
      qb.andWhere('s.user_id = :userId', { userId });
    }
    return qb.orderBy('s.shift').addOrderBy('s.area_name').addOrderBy('s.slot_name').getMany();
  }

  async getDailyRoster(
    schoolId: string | null,
    date: string,
    role: UserRole,
    userId?: string,
    shift?: string,
  ) {
    // Tüm rol için tüm slotları getir; öğretmen sayfasında da o günkü nöbetçiler görünür
    const slots = await this.getSlotsForDate(schoolId, date, UserRole.school_admin, undefined, shift);
    let timetableByUser: Record<string, Record<number, { class_section: string; subject: string }>> = {};
    let maxLessons = 8;
    let educationMode: 'single' | 'double' = 'single';
    try {
      const [school, tb, tl] = await Promise.all([
        schoolId
          ? this.schoolRepo.findOne({ where: { id: schoolId }, select: ['duty_max_lessons', 'duty_education_mode'] })
          : null,
        this.timetableService.getByDate(schoolId, date),
        this.timetableService.getMaxLessons(schoolId),
      ]);
      timetableByUser = tb;
      maxLessons = school?.duty_max_lessons ?? tl ?? 8;
      educationMode = (school?.duty_education_mode as 'single' | 'double' | null) === 'double' ? 'double' : 'single';
    } catch {
      /* timetable yoksa boş */
    }
    const cap = Math.min(12, Math.max(6, maxLessons));
    const slotsWithLessons = slots.map((s) => {
      const lessons = timetableByUser[s.user_id] ?? {};
      const lesson_cells: Record<number, { class_section: string; subject: string }> = {};
      for (let i = 1; i <= cap; i++) {
        if (lessons[i]) lesson_cells[i] = lessons[i];
      }
      // is_mine: öğretmen kendi slotunu vurgulayabilir
      return { ...s, lesson_cells, is_mine: userId ? s.user_id === userId : false };
    });
    return {
      date,
      max_lessons: cap,
      duty_education_mode: educationMode,
      duty_shift: shift === 'morning' || shift === 'afternoon' ? (shift as 'morning' | 'afternoon') : null,
      slots: slotsWithLessons,
    };
  }

  /** Tarih aralığında tüm nöbet slotları – takvim görünümleri için */
  async getSlotsForDateRange(
    schoolId: string | null,
    from: string,
    to: string,
    role: UserRole,
    userId?: string,
    shift?: string,
  ) {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    const qb = this.slotRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.user', 'u')
      .leftJoin('s.duty_plan', 'p')
      .where('p.school_id = :schoolId', { schoolId })
      .andWhere('p.status = :status', { status: 'published' })
      .andWhere('p.deleted_at IS NULL')
      .andWhere('s.deleted_at IS NULL')
      .andWhere('s.date >= :from', { from })
      .andWhere('s.date <= :to', { to });
    if (shift === 'morning' || shift === 'afternoon') {
      qb.andWhere('s.shift = :shift', { shift });
    }
    if (role === UserRole.teacher && userId) {
      qb.andWhere('s.user_id = :userId', { userId });
    }
    return qb.orderBy('s.date').addOrderBy('s.shift').addOrderBy('s.area_name').addOrderBy('s.slot_name').getMany();
  }

  /** Verilen user_id'lerin okulun öğretmenleri (teacher/school_admin, active) arasında olduğunu doğrula */
  private async validateTeachersInSchool(schoolId: string, userIds: string[]): Promise<void> {
    if (userIds.length === 0) return;
    const uniqueIds = [...new Set(userIds)];
    const valid = await this.userRepo
      .createQueryBuilder('u')
      .select('u.id')
      .where('u.school_id = :schoolId', { schoolId })
      .andWhere('u.status = :status', { status: 'active' })
      .andWhere('u.role IN (:...roles)', { roles: ['teacher', 'school_admin'] })
      .andWhere('u.id IN (:...ids)', { ids: uniqueIds })
      .getMany();
    const validIds = new Set(valid.map((u) => u.id));
    const invalid = uniqueIds.filter((id) => !validIds.has(id));
    if (invalid.length > 0) {
      throw new BadRequestException({
        code: 'DUTY_TEACHER_NOT_IN_SCHOOL',
        message: 'Bazı öğretmenler okulunuzda kayıtlı değil veya nöbetçi olarak atanamaz.',
        details: { invalid_user_ids: invalid },
      });
    }
  }

  async createPlan(schoolId: string | null, userId: string, dto: CreateDutyPlanDto) {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    const slotUserIds = (dto.slots ?? []).map((s) => s.user_id).filter((id): id is string => !!id);
    await this.validateTeachersInSchool(schoolId, slotUserIds);
    const plan = this.planRepo.create({
      school_id: schoolId,
      version: dto.version ?? null,
      period_start: dto.period_start ?? null,
      period_end: dto.period_end ?? null,
      academic_year: dto.academic_year ?? null,
      status: 'draft',
      created_by: userId,
    });
    const saved = await this.planRepo.save(plan);
    const slotEntities = (dto.slots ?? []).map((s) =>
      this.slotRepo.create({
        duty_plan_id: saved.id,
        date: s.date,
        shift: s.shift ?? 'morning',
        slot_name: s.slot_name ?? null,
        slot_start_time: s.slot_start_time?.trim() || null,
        slot_end_time: s.slot_end_time?.trim() || null,
        area_name: s.area_name ?? null,
        user_id: s.user_id,
      }),
    );
    await this.slotRepo.save(slotEntities);
    return this.getPlanById(saved.id, schoolId, UserRole.school_admin);
  }

  /** Slot güncelle – school_admin (el ile düzenleme) */
  async updateSlot(slotId: string, schoolId: string | null, dto: UpdateDutySlotDto, userId: string) {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    const slot = await this.slotRepo.findOne({ where: { id: slotId }, relations: ['duty_plan'] });
    if (!slot) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Nöbet kaydı bulunamadı.' });
    if (slot.duty_plan.school_id !== schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    if (dto.user_id) await this.validateTeachersInSchool(schoolId, [dto.user_id]);
    if (dto.date !== undefined) slot.date = dto.date;
    if (dto.shift !== undefined) slot.shift = dto.shift;
    if (dto.slot_name !== undefined) slot.slot_name = dto.slot_name?.trim() || null;
    if (dto.area_name !== undefined) slot.area_name = dto.area_name?.trim() || null;
    if (dto.slot_start_time !== undefined) slot.slot_start_time = dto.slot_start_time?.trim() || null;
    if (dto.slot_end_time !== undefined) slot.slot_end_time = dto.slot_end_time?.trim() || null;
    if (dto.user_id !== undefined) slot.user_id = dto.user_id;
    await this.slotRepo.save(slot);
    return this.slotRepo.findOne({ where: { id: slotId }, relations: ['user'] });
  }

  /** Plana yeni slot ekle – school_admin */
  async addSlotToPlan(planId: string, schoolId: string | null, dto: DutySlotInputDto, userId: string) {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    const plan = await this.planRepo.findOne({ where: { id: planId, deleted_at: IsNull() } });
    if (!plan) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Plan bulunamadı.' });
    if (plan.school_id !== schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu plana erişim yetkiniz yok.' });
    await this.validateTeachersInSchool(schoolId, [dto.user_id]);
    const slot = this.slotRepo.create({
      duty_plan_id: planId,
      date: dto.date,
      shift: dto.shift ?? 'morning',
      slot_name: dto.slot_name?.trim() || null,
      slot_start_time: dto.slot_start_time?.trim() || null,
      slot_end_time: dto.slot_end_time?.trim() || null,
      area_name: dto.area_name?.trim() || null,
      user_id: dto.user_id,
    });
    await this.slotRepo.save(slot);
    return this.slotRepo.findOne({ where: { id: slot.id }, relations: ['user'] });
  }

  /** Plan soft delete – school_admin (istatistikler korunur) */
  async softDeletePlan(planId: string, schoolId: string | null) {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    const plan = await this.planRepo.findOne({ where: { id: planId, deleted_at: IsNull() } });
    if (!plan) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Plan bulunamadı.' });
    if (plan.school_id !== schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu plana erişim yetkiniz yok.' });
    plan.deleted_at = new Date();
    await this.planRepo.save(plan);
    return { success: true };
  }

  /** Planları toplu soft delete – school_admin */
  async softDeletePlansBulk(planIds: string[], schoolId: string | null) {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    const plans = await this.planRepo.find({
      where: { id: In(planIds), school_id: schoolId, deleted_at: IsNull() },
    });
    const now = new Date();
    for (const p of plans) {
      p.deleted_at = now;
    }
    await this.planRepo.save(plans);
    return { success: true, deleted_count: plans.length };
  }

  /** Slot sil – school_admin */
  async deleteSlot(slotId: string, schoolId: string | null) {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    const slot = await this.slotRepo.findOne({ where: { id: slotId }, relations: ['duty_plan'] });
    if (!slot) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Nöbet kaydı bulunamadı.' });
    if (slot.duty_plan.school_id !== schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    await this.slotRepo.remove(slot);
    return { success: true };
  }

  async publishPlan(id: string, schoolId: string | null, userId: string) {
    const plan = await this.planRepo.findOne({
      where: { id, deleted_at: IsNull() },
      relations: ['slots'],
    });
    if (!plan) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Plan bulunamadı.' });
    if (plan.school_id !== schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu plana erişim yetkiniz yok.' });
    if (plan.status === 'published') {
      return { success: true, message: 'Plan zaten yayınlanmış.' };
    }

    // E: Plan tarih çakışma kontrolü – aynı okulda örtüşen başka yayınlanmış plan var mı?
    if (plan.period_start && plan.period_end) {
      const conflict = await this.planRepo
        .createQueryBuilder('p')
        .where('p.school_id = :schoolId', { schoolId })
        .andWhere('p.status = :status', { status: 'published' })
        .andWhere('p.deleted_at IS NULL')
        .andWhere('p.id != :id', { id })
        .andWhere('p.period_start IS NOT NULL')
        .andWhere('p.period_end IS NOT NULL')
        .andWhere('p.period_start <= :end', { end: plan.period_end })
        .andWhere('p.period_end >= :start', { start: plan.period_start })
        .getOne();
      if (conflict) {
        throw new BadRequestException({
          code: 'PLAN_DATE_CONFLICT',
          message: `Bu dönem için zaten yayınlanmış bir plan var: "${conflict.version || conflict.id}" (${conflict.period_start} – ${conflict.period_end}). Önce o planı silin veya dönem aralığını düzenleyin.`,
        });
      }
    }

    plan.status = 'published';
    plan.published_at = new Date();
    await this.planRepo.save(plan);
    await this.logRepo.save(
      this.logRepo.create({
        school_id: plan.school_id,
        action: 'publish',
        duty_slot_id: null,
        old_user_id: null,
        new_user_id: null,
        performed_by: userId,
      }),
    );
    const uniqueUserIds = [...new Set((plan.slots ?? []).map((s) => s.user_id).filter((id): id is string => !!id))];
    const periodStr =
      plan.period_start && plan.period_end
        ? ` (${plan.period_start} – ${plan.period_end})`
        : '';
    for (const uid of uniqueUserIds) {
      const isPublisher = uid === userId;
      const body = isPublisher
        ? `Yayınladığınız plan${periodStr} plandaki öğretmenlere iletildi. Planlar sayfasından görüntüleyebilirsiniz.`
        : `Nöbet planınız yayınlandı${periodStr}. Planı görüntülemek için tıklayın.`;
      await this.notificationsService.createInboxEntry({
        user_id: uid,
        event_type: 'duty.published',
        entity_id: plan.id,
        target_screen: 'nobet',
        title: 'Nöbet planı yayınlandı',
        body,
      });
    }
    return { success: true, message: 'Plan yayınlandı.' };
  }

  async reassignSlot(duty_slot_id: string, new_user_id: string, schoolId: string | null, userId: string) {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    await this.validateTeachersInSchool(schoolId, [new_user_id]);
    const slot = await this.slotRepo.findOne({
      where: { id: duty_slot_id },
      relations: ['duty_plan'],
    });
    if (!slot) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Nöbet kaydı bulunamadı.' });
    if (slot.duty_plan.school_id !== schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    if (slot.deleted_at || slot.duty_plan.deleted_at) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Nöbet kaydı bulunamadı.' });
    }
    const oldUserId = slot.user_id;
    slot.user_id = new_user_id;
    slot.reassigned_from_user_id = oldUserId;
    // lesson_count mevcut slottan alınır; yerine görevlendirilen öğretmen aynı ders yükünü devralır
    // (lesson_count zaten doğru değerde; resetlemeye gerek yok)
    await this.slotRepo.save(slot);
    await this.logRepo.save(
      this.logRepo.create({
        school_id: schoolId,
        action: 'reassign',
        duty_slot_id: slot.id,
        old_user_id: oldUserId,
        new_user_id,
        performed_by: userId,
      }),
    );
    const dateLabel = slot.date
      ? new Date(slot.date + 'T12:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
      : '';
    const areaLabel = slot.area_name ? ` (${slot.area_name})` : '';
    await this.notificationsService.createInboxEntry({
      user_id: new_user_id,
      event_type: 'duty.reassigned',
      entity_id: slot.id,
      target_screen: 'nobet',
      title: 'Yerine görevlendirildiniz',
      body: dateLabel ? `${dateLabel}${areaLabel} nöbet göreviniz size atandı. Günlük listeyi görüntüleyin.` : 'Bir nöbet göreviniz size atandı.',
      metadata: slot.date ? { date: slot.date } : null,
    });
    return { success: true, slot };
  }

  async markAbsent(
    duty_slot_id: string,
    schoolId: string | null,
    userId: string,
    absent_type?: 'raporlu' | 'izinli' | 'gelmeyen',
  ) {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    const slot = await this.slotRepo.findOne({
      where: { id: duty_slot_id },
      relations: ['duty_plan'],
    });
    if (!slot) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Nöbet kaydı bulunamadı.' });
    if (slot.duty_plan.school_id !== schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    if (slot.deleted_at || slot.duty_plan.deleted_at) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Nöbet kaydı bulunamadı.' });
    }
    slot.absent_marked_at = new Date();
    slot.absent_type = absent_type ?? 'gelmeyen';
    await this.slotRepo.save(slot);
    await this.logRepo.save(
      this.logRepo.create({
        school_id: schoolId,
        action: 'absent_marked',
        duty_slot_id: slot.id,
        old_user_id: slot.user_id,
        new_user_id: null,
        performed_by: userId,
      }),
    );

    // Ders bazlı coverage kayıtlarını otomatik oluştur (atanmamış, pending)
    const coverageItems = await this.initCoverageForSlot(schoolId, slot);
    return { success: true, slot, coverage_lessons: coverageItems.map((c) => c.lesson_num) };
  }

  /**
   * Gelmeyen öğretmenin o gündeki DOLU (gerçek sınıf) ders saatlerini hesapla,
   * her biri için DutyCoverage stub kaydı oluştur (covered_by_user_id = null).
   * Boş (nöbet) saatler için coverage oluşturulmaz — sadece gerçek dersler kapsanır.
   */
  private async initCoverageForSlot(schoolId: string, slot: DutySlot): Promise<DutyCoverage[]> {
    // Mevcut coverage kayıtlarını sil ve yenile (absent yeniden işaretlenirse)
    await this.coverageRepo.delete({ duty_slot_id: slot.id });

    // Öğretmenin ders programından DOLU saatlerini bul (gerçek sınıf dersleri)
    let busyLessons: number[] = [];
    try {
      const timetableByDate = await this.timetableService.getByDate(schoolId, slot.date);
      const userSchedule = timetableByDate[slot.user_id] ?? {};
      busyLessons = Object.keys(userSchedule).map(Number).filter((n) => !isNaN(n) && n > 0).sort((a, b) => a - b);
    } catch {
      // Ders programı yoksa slot.lesson_num varsa onu kullan, yoksa boş liste
    }

    // Ders programı yüklü değilse: lesson_num varsa sadece onu ekle (nöbet saati koverage)
    if (busyLessons.length === 0 && slot.lesson_num) {
      busyLessons = [slot.lesson_num];
    }

    if (busyLessons.length === 0) return [];

    const records = busyLessons.map((ln) =>
      this.coverageRepo.create({
        duty_slot_id: slot.id,
        lesson_num: ln,
        covered_by_user_id: null,
        note: null,
      }),
    );
    return this.coverageRepo.save(records);
  }

  async listLogs(
    schoolId: string | null,
    opts?: { limit?: number; from?: string; to?: string; action?: string },
  ) {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    const limit = Math.min(200, Math.max(1, opts?.limit ?? 50));

    const qb = this.logRepo
      .createQueryBuilder('l')
      .leftJoinAndSelect('l.performedByUser', 'u')
      .leftJoinAndSelect('l.oldUser', 'ou')
      .leftJoinAndSelect('l.newUser', 'nu')
      .where('l.school_id = :schoolId', { schoolId })
      .orderBy('l.created_at', 'DESC')
      .take(limit);

    if (opts?.action) {
      qb.andWhere('l.action = :action', { action: opts.action });
    }

    // from/to: YYYY-MM-DD
    if (opts?.from) {
      qb.andWhere('l.created_at >= :from', { from: new Date(opts.from + 'T00:00:00') });
    }
    if (opts?.to) {
      qb.andWhere('l.created_at <= :to', { to: new Date(opts.to + 'T23:59:59') });
    }

    return qb.getMany();
  }

  /** Yerine görevlendirme önerisi – o gün nöbetçilerden, gelmeyen öğretmenin ders saatinde boş olanlar */
  async suggestReplacement(
    schoolId: string | null,
    duty_slot_id: string,
  ) {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    const slot = await this.slotRepo.findOne({
      where: { id: duty_slot_id },
      relations: ['duty_plan'],
    });
    if (!slot) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Nöbet kaydı bulunamadı.' });
    if (slot.duty_plan.school_id !== schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });

    const date = slot.date;
    const dutySlots = await this.getSlotsForDate(schoolId, date, UserRole.school_admin, undefined, slot.shift);
    const dutyUserIds = [...new Set(dutySlots.map((s) => s.user_id))];

    // lesson_num belirtilmişse sadece o saatte dersi olmayan öğretmenler önerilir
    // Belirtilmemişse shift bazlı tahmin: morning=1..5, afternoon=5..9
    const lessonNum: number | undefined = slot.lesson_num
      ? slot.lesson_num
      : undefined;

    const suggestions = await this.timetableService.suggestReplacement(
      schoolId,
      date,
      dutyUserIds,
      lessonNum,
      slot.user_id,
    );

    return suggestions.map((s) => ({
      ...s,
      slot_lesson_num: lessonNum ?? null,
    }));
  }

  /**
   * Okuldaki öğretmenler.
   * excludeExempt=true (varsayılan): duty_exempt=true olanları listeden çıkarır.
   * Takas dropdown gibi manuel seçimlerde tüm öğretmenler görünmeli → excludeExempt=false.
   */
  async listSchoolTeachers(
    schoolId: string | null,
    excludeExempt = true,
    viewer?: { id: string; role: UserRole } | null,
  ) {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    const qb = this.userRepo
      .createQueryBuilder('u')
      // TypeORM select: entity property adları (camelCase) kullanılmalı
      .select([
        'u.id',
        'u.display_name',
        'u.email',
        'u.dutyExempt',
        'u.dutyExemptReason',
        'u.teacherBranch',
        'u.teacherPublicNameMasked',
      ])
      .where('u.school_id = :schoolId', { schoolId })
      .andWhere('u.status = :status', { status: 'active' })
      .andWhere('u.role IN (:...roles)', { roles: ['teacher', 'school_admin'] })
      .orderBy('u.display_name', 'ASC');
    if (excludeExempt) {
      qb.andWhere('(u.dutyExempt IS NULL OR u.dutyExempt = false)');
    }
    const users = await qb.getMany();
    // Frontend snake_case bekliyor; dutyExempt → duty_exempt dönüşümü
    return users.map((u) => {
      let displayName = u.display_name;
      if (
        viewer?.role === UserRole.teacher &&
        u.id !== viewer.id &&
        u.teacherPublicNameMasked !== false
      ) {
        displayName = maskTeacherDisplayName(u.display_name);
      }
      return {
        id: u.id,
        display_name: displayName,
        email: u.email,
        duty_exempt: u.dutyExempt ?? false,
        duty_exempt_reason: u.dutyExemptReason ?? null,
        teacher_branch: u.teacherBranch ?? null,
      };
    });
  }

  /** Öğretmen nöbet muafiyetini ayarla – school_admin. Scope kontrolü yapılır. */
  async setTeacherExempt(
    userId: string,
    schoolId: string | null,
    dutyExempt: boolean,
    dutyExemptReason: string | null,
    performedByUserId: string,
  ) {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Kullanıcı bulunamadı.' });
    if (user.school_id !== schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu kullanıcıya erişim yetkiniz yok.' });
    user.dutyExempt = dutyExempt;
    user.dutyExemptReason = dutyExemptReason;
    await this.userRepo.save(user);
    await this.logRepo.save(
      this.logRepo.create({
        school_id: schoolId,
        action: dutyExempt ? 'duty_exempt_set' : 'duty_exempt_cleared',
        duty_slot_id: null,
        old_user_id: userId,
        new_user_id: null,
        performed_by: performedByUserId,
      }),
    );
    return {
      success: true,
      user_id: userId,
      duty_exempt: dutyExempt,
      duty_exempt_reason: dutyExemptReason,
    };
  }

  async listAreas(schoolId: string | null) {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    return this.areaRepo.find({
      where: { school_id: schoolId },
      order: { sort_order: 'ASC', name: 'ASC' },
    });
  }

  async createArea(schoolId: string | null, name: string, slotsRequired = 1, sortOrder?: number) {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    const area = this.areaRepo.create({
      school_id: schoolId,
      name,
      slotsRequired: Math.min(10, Math.max(1, slotsRequired)),
      ...(typeof sortOrder === 'number' && { sort_order: sortOrder }),
    });
    return this.areaRepo.save(area);
  }

  async updateArea(id: string, schoolId: string | null, dto: { name?: string; sort_order?: number; slots_required?: number }) {
    const area = await this.areaRepo.findOne({ where: { id } });
    if (!area) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Nöbet yeri bulunamadı.' });
    if (area.school_id !== schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    if (dto.name !== undefined) area.name = dto.name;
    if (dto.sort_order !== undefined) area.sort_order = dto.sort_order;
    if (dto.slots_required !== undefined) area.slotsRequired = Math.min(10, Math.max(1, dto.slots_required));
    return this.areaRepo.save(area);
  }

  async deleteArea(id: string, schoolId: string | null) {
    const area = await this.areaRepo.findOne({ where: { id } });
    if (!area) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Nöbet yeri bulunamadı.' });
    if (area.school_id !== schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    await this.areaRepo.remove(area);
    return { success: true };
  }

  /** Yerine görevlendirilmiş slotlar – reassigned_from_user_id dolu olanlar (school_admin) */
  async getReassignedSlots(schoolId: string | null, from?: string, to?: string) {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    const qb = this.slotRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.user', 'u')
      .leftJoinAndSelect('s.reassignedFromUser', 'rfu')
      .leftJoin('s.duty_plan', 'p')
      .where('p.school_id = :schoolId', { schoolId })
      .andWhere('p.status = :status', { status: 'published' })
      .andWhere('p.deleted_at IS NULL')
      .andWhere('s.deleted_at IS NULL')
      .andWhere('s.reassigned_from_user_id IS NOT NULL');
    if (from) qb.andWhere('s.date >= :from', { from });
    if (to) qb.andWhere('s.date <= :to', { to });
    return qb.orderBy('s.date', 'DESC').addOrderBy('s.area_name').getMany();
  }

  /** Öğretmen başına nöbet sayısı – ?from=YYYY-MM-DD&to=YYYY-MM-DD (varsayılan: tüm yayınlanmış) */
  async getSummary(schoolId: string | null, from?: string, to?: string, role?: UserRole, userId?: string) {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });

    // 1. Normal slot sayımları
    const qb = this.slotRepo
      .createQueryBuilder('s')
      .select('s.user_id', 'user_id')
      .addSelect('COUNT(*)::int', 'slot_count')
      .addSelect('SUM(s.lesson_count)::int', 'weighted_count')
      .addSelect('COUNT(*) FILTER (WHERE s.reassigned_from_user_id IS NOT NULL)::int', 'replacement_count')
      .addSelect('COUNT(*) FILTER (WHERE s.reassigned_from_user_id IS NULL)::int', 'regular_count')
      .addSelect('MAX(u.display_name)', 'display_name')
      .addSelect('MAX(u.email)', 'email')
      .innerJoin('s.duty_plan', 'p')
      .leftJoin('s.user', 'u')
      .where('p.school_id = :schoolId', { schoolId })
      .andWhere('p.status = :status', { status: 'published' })
      .groupBy('s.user_id')
      .orderBy('weighted_count', 'DESC');
    if (from) qb.andWhere('s.date >= :from', { from });
    if (to) qb.andWhere('s.date <= :to', { to });
    if (role === UserRole.teacher && userId) qb.andWhere('s.user_id = :userId', { userId });

    const rows = await qb.getRawMany();

    // 2. Coverage (ders saati bazlı görevlendirme) sayımları — ayrı sorgu
    const covQb = this.coverageRepo
      .createQueryBuilder('c')
      .select('c.covered_by_user_id', 'user_id')
      .addSelect('COUNT(*)::int', 'coverage_lesson_count')
      .innerJoin('c.duty_slot', 's')
      .innerJoin('s.duty_plan', 'p')
      .where('p.school_id = :schoolId', { schoolId })
      .andWhere('p.status = :status', { status: 'published' })
      .andWhere('c.covered_by_user_id IS NOT NULL')
      .groupBy('c.covered_by_user_id');
    if (from) covQb.andWhere('s.date >= :from', { from });
    if (to) covQb.andWhere('s.date <= :to', { to });
    if (role === UserRole.teacher && userId) covQb.andWhere('c.covered_by_user_id = :userId', { userId });

    const covRows = await covQb.getRawMany();
    const covMap = new Map<string, number>(covRows.map((r) => [r.user_id, Number(r.coverage_lesson_count) || 0]));

    // 3. Coverage'ı olan ama slot'u olmayan öğretmenleri de ekle
    const slotUserIds = new Set(rows.map((r) => r.user_id));
    const covOnlyUserIds = covRows.filter((r) => !slotUserIds.has(r.user_id)).map((r) => r.user_id);
    let extraUsers: { id: string; display_name: string | null; email: string }[] = [];
    if (covOnlyUserIds.length) {
      extraUsers = await this.userRepo.find({
        where: { id: In(covOnlyUserIds) },
        select: ['id', 'display_name', 'email'],
      });
    }

    const slotItems = rows.map((r) => {
      const coverageLessons = covMap.get(r.user_id) ?? 0;
      return {
        user_id: r.user_id,
        display_name: r.display_name ?? null,
        email: r.email ?? null,
        slot_count: Number(r.slot_count) || 0,
        weighted_count: (Number(r.weighted_count) || Number(r.slot_count) || 0) + coverageLessons,
        replacement_count: Number(r.replacement_count) || 0,
        regular_count: Number(r.regular_count) || 0,
        coverage_lesson_count: coverageLessons,
      };
    });

    const extraItems = extraUsers.map((u) => ({
      user_id: u.id,
      display_name: u.display_name ?? null,
      email: u.email ?? '',
      slot_count: 0,
      weighted_count: covMap.get(u.id) ?? 0,
      replacement_count: 0,
      regular_count: 0,
      coverage_lesson_count: covMap.get(u.id) ?? 0,
    }));

    const items = [...slotItems, ...extraItems].sort((a, b) => b.weighted_count - a.weighted_count);
    return { items };
  }

  /**
   * Belirli bir tarihte nöbetçi olan öğretmenleri döndür (teacher rolü için de erişilebilir).
   * "Bugün nöbet arkadaşlarım" paneli için kullanılır.
   */
  async getDutyPartners(
    schoolId: string | null,
    date: string,
    excludeUserId?: string,
  ) {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    const qb = this.slotRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.user', 'u')
      .innerJoin('s.duty_plan', 'p')
      .where('p.school_id = :schoolId', { schoolId })
      .andWhere('p.status = :status', { status: 'published' })
      .andWhere('p.deleted_at IS NULL')
      .andWhere('s.deleted_at IS NULL')
      .andWhere('s.absent_marked_at IS NULL')
      .andWhere('s.date = :date', { date });
    if (excludeUserId) {
      qb.andWhere('s.user_id != :excludeId', { excludeId: excludeUserId });
    }
    const slots = await qb.getMany();
    // Tekrarlanan user_id'leri filtrele
    const seen = new Set<string>();
    return slots
      .filter((s) => {
        if (seen.has(s.user_id)) return false;
        seen.add(s.user_id);
        return true;
      })
      .map((s) => ({
        user_id: s.user_id,
        display_name: s.user?.display_name ?? null,
        email: s.user?.email ?? '',
        area_name: s.area_name,
        shift: s.shift,
      }));
  }

  /** Nöbet takas / değişim talebi oluştur – teacher: kendi slotunda */
  async createSwapRequest(
    duty_slot_id: string,
    proposed_user_id: string | null | undefined,
    schoolId: string | null,
    userId: string,
    request_type: 'swap' | 'day_change' | 'coverage_swap' = 'swap',
    coverage_id?: string | null,
  ) {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });

    const features = await this.getTeacherFeatures(schoolId);
    if (!features.swap_enabled) {
      throw new ForbiddenException({
        code: 'FEATURE_DISABLED',
        message: 'Görev Devri özelliği okul yöneticiniz tarafından devre dışı bırakıldı. Detay için Nöbet > Ayarlar sayfasına bakın.',
      });
    }

    if (request_type === 'swap' || request_type === 'coverage_swap') {
      if (!proposed_user_id) {
        throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Bu talep tipi için proposed_user_id zorunludur.' });
      }
      await this.validateTeachersInSchool(schoolId, [proposed_user_id]);
    }

    if (request_type === 'coverage_swap') {
      if (!coverage_id) {
        throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'coverage_swap için coverage_id zorunludur.' });
      }
      const cov = await this.coverageRepo.findOne({ where: { id: coverage_id } });
      if (!cov) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Ders görevi kaydı bulunamadı.' });
      if (cov.covered_by_user_id !== userId) {
        throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Sadece size atanan ders görevleri için değişim talebinde bulunabilirsiniz.' });
      }
    }

    const slot = await this.slotRepo.findOne({ where: { id: duty_slot_id }, relations: ['duty_plan'] });
    if (!slot) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Nöbet kaydı bulunamadı.' });
    if (slot.duty_plan.school_id !== schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    if (slot.deleted_at || slot.duty_plan.deleted_at) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Nöbet kaydı bulunamadı.' });
    }
    if (request_type !== 'coverage_swap' && slot.user_id !== userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Sadece kendi nöbetiniz için takas talebi oluşturabilirsiniz.' });
    }
    if (request_type === 'coverage_swap' && slot.user_id !== userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu nöbet slotuna ait değilsiniz.' });
    }
    const existing = await this.swapRepo.findOne({ where: { duty_slot_id, status: 'pending', request_type } });
    if (existing && request_type !== 'coverage_swap') {
      throw new ForbiddenException({ code: 'ALREADY_EXISTS', message: 'Bu nöbet için zaten beklemede bir talep var.' });
    }

    // 'swap' tipi: önerilen öğretmen aynı gün nöbetçi olmalı
    if (request_type === 'swap' && proposed_user_id) {
      const proposedOnDuty = await this.slotRepo
        .createQueryBuilder('s')
        .innerJoin('s.duty_plan', 'p')
        .where('p.school_id = :schoolId', { schoolId })
        .andWhere('p.status = :status', { status: 'published' })
        .andWhere('p.deleted_at IS NULL')
        .andWhere('s.deleted_at IS NULL')
        .andWhere('s.date = :date', { date: slot.date })
        .andWhere('s.user_id = :uid', { uid: proposed_user_id })
        .getOne();
      if (!proposedOnDuty) {
        throw new BadRequestException({
          code: 'NOT_ON_DUTY',
          message: 'Seçilen öğretmen o gün nöbetçi değil. Nöbet takası yalnızca aynı günde nöbetçi olan öğretmenler arasında yapılabilir.',
        });
      }
    }

    // 'coverage_swap' tipi: önerilen öğretmenin ilgili ders saatinde dersi olmamalı
    if (request_type === 'coverage_swap' && proposed_user_id && coverage_id) {
      const covRecord = await this.coverageRepo.findOne({ where: { id: coverage_id } });
      if (covRecord) {
        try {
          const timetable = await this.timetableService.getByDate(schoolId, slot.date);
          const proposedLessons = timetable[proposed_user_id] ?? {};
          if (proposedLessons[covRecord.lesson_num]) {
            throw new BadRequestException({
              code: 'TEACHER_BUSY',
              message: `Seçilen öğretmenin ${covRecord.lesson_num}. ders saatinde dersi var. Lütfen o saatte boş olan bir öğretmen seçin.`,
            });
          }
        } catch (e) {
          if (e instanceof BadRequestException) throw e;
          // Ders programı yüklü değilse kontrolü geç
        }
      }
    }

    const teacher2_status: 'pending' | null = (request_type === 'swap' || request_type === 'coverage_swap') ? 'pending' : null;

    const req = this.swapRepo.create({
      duty_slot_id,
      school_id: schoolId,
      requested_by_user_id: userId,
      proposed_user_id: proposed_user_id ?? null,
      request_type,
      teacher2_status,
      coverage_id: coverage_id ?? null,
      status: 'pending',
    });
    await this.swapRepo.save(req);

    if ((request_type === 'swap' || request_type === 'coverage_swap') && proposed_user_id) {
      const requester = await this.userRepo.findOne({ where: { id: userId }, select: ['display_name', 'email'] });
      const requesterName = requester?.display_name || requester?.email || 'Bir öğretmen';
      const body = request_type === 'coverage_swap'
        ? `${requesterName}, ${slot.date} tarihli ders görevi için sizinle değişim istiyor.`
        : `${requesterName}, ${slot.date} tarihli nöbetini size devretmek istiyor.`;
      await this.notificationsService.createInboxEntry({
        user_id: proposed_user_id,
        event_type: 'duty.swap_requested',
        entity_id: req.id,
        target_screen: 'nobet_takas',
        title: request_type === 'coverage_swap' ? 'Ders görevi değişim talebi' : 'Nöbet devir talebi',
        body,
      });
    }

    return req;
  }

  /** Takas talebini öğretmen B (proposed_user) olarak onayla/reddet */
  async teacherRespondSwap(
    id: string,
    userId: string,
    schoolId: string | null,
    action: 'approved' | 'rejected',
  ) {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    const req = await this.swapRepo.findOne({
      where: { id },
      relations: ['duty_slot', 'duty_slot.duty_plan'],
    });
    if (!req) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Takas talebi bulunamadı.' });
    if (req.school_id !== schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    if (req.proposed_user_id !== userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu talep size yönlendirilmemiş.' });
    }
    if (req.status !== 'pending') throw new ForbiddenException({ code: 'ALREADY_PROCESSED', message: 'Bu talep zaten işlenmiş.' });
    if (req.teacher2_status !== 'pending') {
      throw new ForbiddenException({ code: 'ALREADY_PROCESSED', message: 'Bu talebe zaten yanıt verdiniz.' });
    }
    req.teacher2_status = action;
    await this.swapRepo.save(req);

    const teacher2 = await this.userRepo.findOne({ where: { id: userId }, select: ['display_name', 'email'] });
    const teacher2Name = teacher2?.display_name || teacher2?.email || 'Öğretmen';

    if (action === 'approved') {
      // Admin'e bildirim: onay bekleniyor
      const admins = await this.userRepo.find({ where: { school_id: schoolId, role: UserRole.school_admin } });
      for (const admin of admins) {
        await this.notificationsService.createInboxEntry({
          user_id: admin.id,
          event_type: 'duty.swap_teacher2_approved',
          entity_id: req.id,
          target_screen: 'nobet_takas',
          title: 'Nöbet takası onay bekliyor',
          body: `${teacher2Name} nöbet takas talebini kabul etti. Admin onayı bekleniyor.`,
        });
      }
    } else {
      // Teacher 1'e red bildirimi
      await this.notificationsService.createInboxEntry({
        user_id: req.requested_by_user_id,
        event_type: 'duty.swap_rejected',
        entity_id: req.id,
        target_screen: 'nobet_takas',
        title: 'Takas talebiniz reddedildi',
        body: `${teacher2Name} takas talebinizi reddetti.`,
      });
    }

    return { success: true, teacher2_status: req.teacher2_status };
  }

  /** Takas taleplerini listele – teacher: kendi veya kendine gelen, admin: okul geneli */
  async listSwapRequests(schoolId: string | null, role: UserRole, userId?: string) {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    const qb = this.swapRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.duty_slot', 's')
      .leftJoinAndSelect('s.duty_plan', 'p')
      .leftJoinAndSelect('s.user', 'su')
      .leftJoinAndSelect('r.requestedByUser', 'rbu')
      .leftJoinAndSelect('r.proposedUser', 'pu')
      .leftJoinAndSelect('r.coverage', 'cov')
      .where('r.school_id = :schoolId', { schoolId })
      .andWhere('s.deleted_at IS NULL')
      .andWhere('p.deleted_at IS NULL');
    if (role === UserRole.teacher && userId) {
      // Kendi oluşturduğu veya kendine gelen talepler
      qb.andWhere('(r.requested_by_user_id = :userId OR r.proposed_user_id = :userId)', { userId });
    }
    return qb.orderBy('r.created_at', 'DESC').getMany();
  }

  /** Takas talebini iptal et – teacher: sadece kendi beklemedeki talebi; school_admin: herhangi beklemedeki talebi */
  async cancelSwapRequest(id: string, schoolId: string | null, userId: string, role: UserRole) {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    const req = await this.swapRepo.findOne({ where: { id }, relations: ['duty_slot'] });
    if (!req) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Takas talebi bulunamadı.' });
    if (req.school_id !== schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    if (req.status !== 'pending') throw new BadRequestException({ code: 'ALREADY_PROCESSED', message: 'Beklemedeki talepler iptal edilebilir.' });
    if (role === UserRole.teacher && req.requested_by_user_id !== userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Sadece kendi talebinizi iptal edebilirsiniz.' });
    }
    await this.swapRepo.delete(id);
    return { success: true, message: 'Talep iptal edildi.' };
  }

  /** Takas talebini onayla/reddet – school_admin (teacher2_status bağımsız bypass edebilir) */
  async respondSwapRequest(
    id: string,
    status: 'approved' | 'rejected',
    admin_note: string | undefined,
    schoolId: string | null,
    adminUserId: string,
    proposed_user_id_override?: string | null,
  ) {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    const req = await this.swapRepo.findOne({
      where: { id },
      relations: ['duty_slot', 'duty_slot.duty_plan'],
    });
    if (!req) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Takas talebi bulunamadı.' });
    if (req.school_id !== schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    if (req.status !== 'pending') throw new ForbiddenException({ code: 'ALREADY_PROCESSED', message: 'Bu talep zaten işlenmiş.' });
    if (req.duty_slot?.deleted_at || req.duty_slot?.duty_plan?.deleted_at) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Takas talebi bulunamadı.' });
    }

    // Admin, proposed_user override edebilir (özellikle day_change ve coverage_swap için)
    if (proposed_user_id_override) {
      await this.validateTeachersInSchool(schoolId, [proposed_user_id_override]);
      req.proposed_user_id = proposed_user_id_override;
    }

    req.status = status;
    req.admin_note = admin_note ?? null;
    // Admin onaylarsa teacher2_status güncelle
    if (status === 'approved' && req.teacher2_status === 'pending') {
      req.teacher2_status = 'approved';
    }
    await this.swapRepo.save(req);

    if (status === 'approved') {
      if (req.request_type === 'coverage_swap') {
        // Coverage değişimi: coverage.covered_by_user_id güncelle
        if (!req.proposed_user_id) {
          throw new BadRequestException({ code: 'MISSING_PROPOSED_USER', message: 'Ders görevi değişimi için proposed_user_id zorunludur.' });
        }
        if (!req.coverage_id) {
          throw new BadRequestException({ code: 'MISSING_COVERAGE', message: 'Ders görevi kaydı bulunamadı.' });
        }
        const coverage = await this.coverageRepo.findOne({ where: { id: req.coverage_id } });
        if (coverage) {
          const oldUser = coverage.covered_by_user_id;
          coverage.covered_by_user_id = req.proposed_user_id;
          await this.coverageRepo.save(coverage);
          await this.logRepo.save(this.logRepo.create({
            school_id: schoolId,
            action: 'coverage_assigned',
            duty_slot_id: req.duty_slot_id,
            old_user_id: oldUser,
            new_user_id: req.proposed_user_id,
            performed_by: adminUserId,
          }));
        }
      } else if (req.request_type === 'swap' || req.request_type === 'day_change') {
        if (!req.proposed_user_id) {
          throw new BadRequestException({ code: 'MISSING_PROPOSED_USER', message: 'Gün/ders değişimi talepleri için lütfen görevlendirilecek öğretmeni seçin.' });
        }
        await this.reassignSlot(req.duty_slot_id, req.proposed_user_id, schoolId, adminUserId);
      }
    }

    await this.notificationsService.createInboxEntry({
      user_id: req.requested_by_user_id,
      event_type: 'duty.swap_' + status,
      entity_id: req.id,
      target_screen: 'nobet',
      title: status === 'approved' ? 'Takas talebiniz onaylandı' : 'Takas talebiniz reddedildi',
      body: admin_note || (status === 'approved' ? 'Takas uygulandı.' : 'Takas yapılmadı.'),
    });
    return { success: true, request: req };
  }

  /** Tarih aralığında belirtilen günlere uyan tarihleri üret (1=Pzt .. 6=Cmt) */
  private datesForRecurring(periodFrom: string, periodTo: string, dayOfWeek: number[]): string[] {
    const out: string[] = [];
    const from = new Date(periodFrom + 'T12:00:00');
    const to = new Date(periodTo + 'T12:00:00');
    const set = new Set(dayOfWeek);
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      const w = d.getDay(); // 0=Sun, 1=Mon, ... 6=Sat
      if (set.has(w)) {
        out.push(d.toISOString().slice(0, 10));
      }
    }
    return out;
  }

  /** Tercih ekle – teacher. Tek gün veya her hafta (day_of_week + period) */
  async createPreference(
    dto: { date?: string; day_of_week?: number[]; period_from?: string; period_to?: string; status: 'available' | 'unavailable' | 'prefer'; note?: string },
    schoolId: string | null,
    userId: string,
  ) {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });

    const features = await this.getTeacherFeatures(schoolId);
    if (!features.preferences_enabled) {
      throw new ForbiddenException({
        code: 'FEATURE_DISABLED',
        message: 'Tercihlerim özelliği okul yöneticiniz tarafından devre dışı bırakıldı. Detay için Nöbet > Ayarlar sayfasına bakın.',
      });
    }

    const { status, note } = dto;

    const dates: string[] = [];
    if (dto.date) {
      dates.push(dto.date);
    } else if (
      Array.isArray(dto.day_of_week) &&
      dto.day_of_week.length > 0 &&
      dto.period_from &&
      dto.period_to &&
      dto.period_from <= dto.period_to
    ) {
      dates.push(...this.datesForRecurring(dto.period_from, dto.period_to, dto.day_of_week));
    }
    if (dates.length === 0) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Tek gün (date) veya her hafta (day_of_week, period_from, period_to) girin.' });
    }
    if (dates.length > 200) {
      throw new BadRequestException({ code: 'TOO_MANY', message: 'En fazla 200 tercih oluşturulabilir. Tarih aralığını daraltın.' });
    }

    // I: Toplu upsert – N sorgu yerine tek SELECT + batch save
    const existing = await this.prefRepo
      .createQueryBuilder('p')
      .where('p.school_id = :schoolId', { schoolId })
      .andWhere('p.user_id = :userId', { userId })
      .andWhere('p.date IN (:...dates)', { dates })
      .getMany();
    const existingByDate = new Map(existing.map((p) => [p.date, p]));

    const toSave: DutyPreference[] = dates.map((date) => {
      const ex = existingByDate.get(date);
      if (ex) {
        ex.status = status;
        ex.note = note ?? null;
        return ex;
      }
      return this.prefRepo.create({ school_id: schoolId, user_id: userId, date, status, note: note ?? null });
    });
    const saved = await this.prefRepo.save(toSave);
    return saved.length === 1 ? saved[0] : { created: saved.length, preferences: saved };
  }

  /** Tercihleri listele – teacher: kendi, admin: okul geneli, ?from=&to= */
  async listPreferences(schoolId: string | null, role: UserRole, userId?: string, from?: string, to?: string) {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    const qb = this.prefRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.user', 'u')
      .where('p.school_id = :schoolId', { schoolId });
    if (role === UserRole.teacher && userId) {
      qb.andWhere('p.user_id = :userId', { userId });
    }
    if (from) qb.andWhere('p.date >= :from', { from });
    if (to) qb.andWhere('p.date <= :to', { to });
    return qb.orderBy('p.date', 'ASC').getMany();
  }

  /** Okul varsayılan nöbet saatleri + ders saatleri – GET */
  async getSchoolDefaultTimes(schoolId: string | null) {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    const school = await this.schoolRepo.findOne({
      where: { id: schoolId },
      select: [
        'duty_start_time',
        'duty_end_time',
        'lesson_schedule',
        'duty_education_mode',
        'duty_max_lessons',
        'duty_start_time_pm',
        'duty_end_time_pm',
        'lesson_schedule_pm',
        'principalName',
        'district',
      ],
    });
    return {
      duty_start_time: school?.duty_start_time ?? null,
      duty_end_time: school?.duty_end_time ?? null,
      lesson_schedule: school?.lesson_schedule ?? [],
      duty_education_mode: (school?.duty_education_mode as 'single' | 'double' | null) ?? 'single',
      duty_max_lessons: school?.duty_max_lessons ?? null,
      duty_start_time_pm: school?.duty_start_time_pm ?? null,
      duty_end_time_pm: school?.duty_end_time_pm ?? null,
      lesson_schedule_pm: school?.lesson_schedule_pm ?? [],
      principal_name: school?.principalName ?? null,
      district: school?.district ?? null,
    };
  }

  /** Öğretmen özellikleri – Görev Devri ve Tercihlerim okul admin tarafından açık/kapalı. */
  async getTeacherFeatures(schoolId: string | null): Promise<{ swap_enabled: boolean; preferences_enabled: boolean }> {
    if (!schoolId) {
      return { swap_enabled: true, preferences_enabled: true };
    }
    const school = await this.schoolRepo.findOne({
      where: { id: schoolId },
      select: ['duty_teacher_swap_enabled', 'duty_teacher_preferences_enabled'],
    });
    return {
      swap_enabled: school?.duty_teacher_swap_enabled ?? true,
      preferences_enabled: school?.duty_teacher_preferences_enabled ?? true,
    };
  }

  /** Tebliğ şablonları – GET (school_admin) */
  async getTebligTemplates(
    schoolId: string | null,
  ): Promise<{
    duty_template: string | null;
    coverage_template: string | null;
    bos_ders_paragraf: string | null;
    bos_ders_konu: string | null;
    school_name: string;
    school_district: string | null;
    principal_name: string | null;
    deputy_principal_name: string | null;
    haftalik_baslik: string | null;
    haftalik_duty_duties_text: string | null;
    duty_start_time: string | null;
    duty_end_time: string | null;
    duty_education_mode: 'single' | 'double';
    duty_start_time_pm: string | null;
    duty_end_time_pm: string | null;
  }> {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    const school = await this.schoolRepo.findOne({
      where: { id: schoolId },
      select: [
        'name',
        'district',
        'principalName',
        'duty_start_time',
        'duty_end_time',
        'duty_education_mode',
        'duty_start_time_pm',
        'duty_end_time_pm',
        'duty_teblig_duty_template',
        'duty_teblig_coverage_template',
        'duty_teblig_bos_ders_paragraf',
        'duty_teblig_bos_ders_konu',
        'duty_teblig_deputy_principal_name',
        'duty_teblig_haftalik_baslik',
        'duty_teblig_haftalik_duty_duties_text',
      ],
    });
    if (!school) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Okul bulunamadı.' });
    return {
      duty_template: school.duty_teblig_duty_template,
      coverage_template: school.duty_teblig_coverage_template,
      bos_ders_paragraf: school.duty_teblig_bos_ders_paragraf,
      bos_ders_konu: school.duty_teblig_bos_ders_konu,
      school_name: school.name,
      school_district: school.district ?? null,
      principal_name: school.principalName,
      duty_start_time: school.duty_start_time ?? null,
      duty_end_time: school.duty_end_time ?? null,
      duty_education_mode: (school.duty_education_mode as 'single' | 'double' | null) ?? 'single',
      duty_start_time_pm: school.duty_start_time_pm ?? null,
      duty_end_time_pm: school.duty_end_time_pm ?? null,
      deputy_principal_name: school.duty_teblig_deputy_principal_name,
      haftalik_baslik: school.duty_teblig_haftalik_baslik ?? null,
      haftalik_duty_duties_text: school.duty_teblig_haftalik_duty_duties_text ?? null,
    };
  }

  /** Tebliğ şablonları – PATCH (school_admin) */
  async updateTebligTemplates(
    schoolId: string | null,
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
  ): Promise<{
    duty_template: string | null;
    coverage_template: string | null;
    bos_ders_paragraf: string | null;
    bos_ders_konu: string | null;
    deputy_principal_name: string | null;
    haftalik_baslik: string | null;
    haftalik_duty_duties_text: string | null;
  }> {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
    if (!school) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Okul bulunamadı.' });
    if (body.duty_template !== undefined) school.duty_teblig_duty_template = body.duty_template?.trim() || null;
    if (body.coverage_template !== undefined) school.duty_teblig_coverage_template = body.coverage_template?.trim() || null;
    if (body.bos_ders_paragraf !== undefined) school.duty_teblig_bos_ders_paragraf = body.bos_ders_paragraf || null;
    if (body.bos_ders_konu !== undefined) school.duty_teblig_bos_ders_konu = body.bos_ders_konu || null;
    if (body.principal_name !== undefined) school.principalName = body.principal_name?.trim() || null;
    if (body.deputy_principal_name !== undefined) school.duty_teblig_deputy_principal_name = body.deputy_principal_name?.trim() || null;
    if (body.haftalik_baslik !== undefined) school.duty_teblig_haftalik_baslik = body.haftalik_baslik || null;
    if (body.haftalik_duty_duties_text !== undefined) school.duty_teblig_haftalik_duty_duties_text = body.haftalik_duty_duties_text || null;
    await this.schoolRepo.save(school);
    return {
      duty_template: school.duty_teblig_duty_template,
      coverage_template: school.duty_teblig_coverage_template,
      bos_ders_paragraf: school.duty_teblig_bos_ders_paragraf,
      bos_ders_konu: school.duty_teblig_bos_ders_konu,
      deputy_principal_name: school.duty_teblig_deputy_principal_name,
      haftalik_baslik: school.duty_teblig_haftalik_baslik,
      haftalik_duty_duties_text: school.duty_teblig_haftalik_duty_duties_text,
    };
  }

  /** Öğretmen özellikleri güncelle – school_admin */
  async updateTeacherFeatures(
    schoolId: string | null,
    body: { swap_enabled?: boolean; preferences_enabled?: boolean },
  ): Promise<{ swap_enabled: boolean; preferences_enabled: boolean }> {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
    if (!school) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Okul bulunamadı.' });
    if (body.swap_enabled !== undefined) school.duty_teacher_swap_enabled = !!body.swap_enabled;
    if (body.preferences_enabled !== undefined) school.duty_teacher_preferences_enabled = !!body.preferences_enabled;
    await this.schoolRepo.save(school);
    return {
      swap_enabled: school.duty_teacher_swap_enabled,
      preferences_enabled: school.duty_teacher_preferences_enabled,
    };
  }

  /** Okul varsayılan nöbet saatleri + ders saatleri – PATCH (school_admin) */
  async updateSchoolDefaultTimes(
    schoolId: string | null,
    body: {
      duty_education_mode?: 'single' | 'double' | null;
      duty_max_lessons?: number | null;
      duty_start_time?: string | null;
      duty_end_time?: string | null;
      lesson_schedule?: { lesson_num: number; start_time: string; end_time: string }[] | null;
      duty_start_time_pm?: string | null;
      duty_end_time_pm?: string | null;
      lesson_schedule_pm?: { lesson_num: number; start_time: string; end_time: string }[] | null;
      principal_name?: string | null;
      district?: string | null;
    },
  ) {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
    if (!school) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Okul bulunamadı.' });

    if (body.duty_education_mode !== undefined) {
      const mode = body.duty_education_mode;
      school.duty_education_mode = mode === 'double' ? 'double' : 'single';
    }
    if (body.duty_max_lessons !== undefined) {
      const n = body.duty_max_lessons;
      if (n == null) school.duty_max_lessons = null;
      else school.duty_max_lessons = Math.min(12, Math.max(6, Number(n) || 0)) || null;
    }
    if (body.duty_start_time !== undefined) school.duty_start_time = body.duty_start_time?.trim() || null;
    if (body.duty_end_time !== undefined) school.duty_end_time = body.duty_end_time?.trim() || null;
    if (body.lesson_schedule !== undefined) {
      school.lesson_schedule = Array.isArray(body.lesson_schedule) ? body.lesson_schedule : null;
    }
    if (body.duty_start_time_pm !== undefined) school.duty_start_time_pm = body.duty_start_time_pm?.trim() || null;
    if (body.duty_end_time_pm !== undefined) school.duty_end_time_pm = body.duty_end_time_pm?.trim() || null;
    if (body.lesson_schedule_pm !== undefined) {
      school.lesson_schedule_pm = Array.isArray(body.lesson_schedule_pm) ? body.lesson_schedule_pm : null;
    }
    if (body.principal_name !== undefined) school.principalName = body.principal_name?.trim() || null;
    if (body.district !== undefined) school.district = body.district?.trim() || null;
    await this.schoolRepo.save(school);
    return {
      duty_start_time: school.duty_start_time,
      duty_end_time: school.duty_end_time,
      lesson_schedule: school.lesson_schedule ?? [],
      duty_education_mode: (school.duty_education_mode as 'single' | 'double' | null) ?? 'single',
      duty_max_lessons: school.duty_max_lessons ?? null,
      duty_start_time_pm: school.duty_start_time_pm ?? null,
      duty_end_time_pm: school.duty_end_time_pm ?? null,
      lesson_schedule_pm: school.lesson_schedule_pm ?? [],
      principal_name: school.principalName ?? null,
      district: school.district ?? null,
    };
  }

  /** Tercih dikkate alındı – school_admin */
  async confirmPreference(id: string, schoolId: string | null, adminUserId: string) {
    const pref = await this.prefRepo.findOne({ where: { id } });
    if (!pref) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Tercih bulunamadı.' });
    if (pref.school_id !== schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    pref.admin_confirmed_at = new Date();
    pref.admin_confirmed_by = adminUserId;
    return this.prefRepo.save(pref);
  }

  /** Tercih onayını geri al – school_admin */
  async unconfirmPreference(id: string, schoolId: string | null) {
    const pref = await this.prefRepo.findOne({ where: { id } });
    if (!pref) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Tercih bulunamadı.' });
    if (pref.school_id !== schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    pref.admin_confirmed_at = null;
    pref.admin_confirmed_by = null;
    return this.prefRepo.save(pref);
  }

  /** Tercih sil – teacher: kendi */
  async deletePreference(id: string, schoolId: string | null, userId: string) {
    const pref = await this.prefRepo.findOne({ where: { id } });
    if (!pref) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Tercih bulunamadı.' });
    if (pref.school_id !== schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    if (pref.user_id !== userId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Sadece kendi tercihinizi silebilirsiniz.' });
    await this.prefRepo.remove(pref);
    return { success: true };
  }

  /** Öğretmenin belirtilen tarihte devamsızlık kaydı var mı? */
  async isUserAbsentOnDate(schoolId: string, userId: string, date: string): Promise<boolean> {
    const count = await this.absenceRepo
      .createQueryBuilder('a')
      .where('a.school_id = :schoolId', { schoolId })
      .andWhere('a.user_id = :userId', { userId })
      .andWhere('a.date_from <= :date', { date })
      .andWhere('a.date_to >= :date', { date })
      .getCount();
    return count > 0;
  }

  /** Devamsızlık ekle – school_admin. Aynı tarih aralığındaki duty_slot kayıtları otomatik işaretlenir. */
  async createAbsence(
    schoolId: string | null,
    userId: string,
    dto: { user_id: string; date_from: string; date_to: string; absence_type: 'raporlu' | 'izinli' | 'gelmeyen'; note?: string },
  ) {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    await this.validateTeachersInSchool(schoolId, [dto.user_id]);
    if (dto.date_from > dto.date_to) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Bitiş tarihi başlangıçtan önce olamaz.' });
    }
    const abs = this.absenceRepo.create({
      school_id: schoolId,
      user_id: dto.user_id,
      date_from: dto.date_from,
      date_to: dto.date_to,
      absence_type: dto.absence_type,
      note: dto.note?.trim() || null,
      created_by: userId,
    });
    const saved = await this.absenceRepo.save(abs);

    // Tarih aralığındaki duty_slot kayıtlarını devamsız işaretle (Takvim/Günlük tablo ile senkron)
    const slots = await this.slotRepo
      .createQueryBuilder('s')
      .innerJoin('s.duty_plan', 'p')
      .where('p.school_id = :schoolId', { schoolId })
      .andWhere('p.deleted_at IS NULL')
      .andWhere('p.status = :status', { status: 'published' })
      .andWhere('s.deleted_at IS NULL')
      .andWhere('s.user_id = :userId', { userId: dto.user_id })
      .andWhere('s.date >= :from', { from: dto.date_from })
      .andWhere('s.date <= :to', { to: dto.date_to })
      .andWhere('s.absent_marked_at IS NULL')
      .getMany();

    for (const slot of slots) {
      slot.absent_marked_at = new Date();
      slot.absent_type = dto.absence_type;
      await this.slotRepo.save(slot);
      await this.logRepo.save(
        this.logRepo.create({
          school_id: schoolId,
          action: 'absent_marked',
          duty_slot_id: slot.id,
          old_user_id: slot.user_id,
          new_user_id: null,
          performed_by: userId,
        }),
      );
      await this.initCoverageForSlot(schoolId, slot);
    }

    return saved;
  }

  /** Bekleyen coverage sayısı – devamsız işaretli slotlarda atanmamış ders (school_admin, nav badge için) */
  async getPendingCoverageCount(schoolId: string | null, from?: string, to?: string): Promise<number> {
    if (!schoolId) return 0;
    const today = new Date().toISOString().slice(0, 10);
    const toDate = to || (() => {
      const d = new Date();
      d.setDate(d.getDate() + 60);
      return d.toISOString().slice(0, 10);
    })();
    const fromDate = from || today;
    const row = await this.coverageRepo
      .createQueryBuilder('c')
      .select('COUNT(DISTINCT c.duty_slot_id)::int', 'cnt')
      .innerJoin('c.duty_slot', 's')
      .innerJoin('s.duty_plan', 'p')
      .where('p.school_id = :schoolId', { schoolId })
      .andWhere('p.deleted_at IS NULL')
      .andWhere('s.deleted_at IS NULL')
      .andWhere('s.absent_marked_at IS NOT NULL')
      .andWhere('s.date >= :from', { from: fromDate })
      .andWhere('s.date <= :to', { to: toDate })
      .andWhere('c.covered_by_user_id IS NULL')
      .getRawOne();
    return Number(row?.cnt) || 0;
  }

  /** Devamsızlıkları listele – ?from=&to= */
  async listAbsences(schoolId: string | null, from?: string, to?: string) {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    const qb = this.absenceRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.user', 'u')
      .where('a.school_id = :schoolId', { schoolId });
    if (from) qb.andWhere('a.date_to >= :from', { from });
    if (to) qb.andWhere('a.date_from <= :to', { to });
    return qb.orderBy('a.date_from', 'DESC').getMany();
  }

  /** Devamsızlık sil – school_admin */
  async deleteAbsence(id: string, schoolId: string | null) {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    const abs = await this.absenceRepo.findOne({ where: { id } });
    if (!abs) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Devamsızlık kaydı bulunamadı.' });
    if (abs.school_id !== schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu kayda erişim yetkiniz yok.' });
    await this.absenceRepo.remove(abs);
    return { success: true };
  }

  /** Günlük tablodan işaretlenen slotlar – DutyAbsence kaydı olmayan (Devamsızlık sekmesinde gösterilir) */
  async getAbsentSlotsOnly(schoolId: string | null, from: string, to: string) {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    const slots = await this.slotRepo
      .createQueryBuilder('s')
      .innerJoin('s.duty_plan', 'p')
      .leftJoinAndSelect('s.user', 'u')
      .where('p.school_id = :schoolId', { schoolId })
      .andWhere('p.deleted_at IS NULL')
      .andWhere('s.deleted_at IS NULL')
      .andWhere('s.absent_marked_at IS NOT NULL')
      .andWhere('s.date >= :from', { from })
      .andWhere('s.date <= :to', { to })
      .orderBy('s.date', 'ASC')
      .addOrderBy('s.id', 'ASC')
      .getMany();

    const absences = await this.absenceRepo
      .createQueryBuilder('a')
      .select(['a.user_id', 'a.date_from', 'a.date_to'])
      .where('a.school_id = :schoolId', { schoolId })
      .andWhere('a.date_to >= :from', { from })
      .andWhere('a.date_from <= :to', { to })
      .getMany();

    const coveredSet = new Set<string>();
    for (const abs of absences) {
      for (const slot of slots) {
        if (slot.user_id === abs.user_id && slot.date >= abs.date_from && slot.date <= abs.date_to) {
          coveredSet.add(slot.id);
        }
      }
    }

    const filtered = slots.filter((s) => !coveredSet.has(s.id));
    return filtered.map((s) => ({
      id: s.id,
      date: s.date,
      absent_type: s.absent_type || 'gelmeyen',
      user_id: s.user_id,
      user: s.user ? { display_name: s.user.display_name, email: s.user.email } : null,
    }));
  }

  /** Slot devamsızlık işaretini kaldır – günlük tablodan işaretlenenler için */
  async clearSlotAbsent(slotId: string, schoolId: string | null) {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    const slot = await this.slotRepo.findOne({
      where: { id: slotId },
      relations: ['duty_plan'],
    });
    if (!slot) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Nöbet kaydı bulunamadı.' });
    if (slot.duty_plan.school_id !== schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu kayda erişim yetkiniz yok.' });
    if (!slot.absent_marked_at) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Bu slot devamsız işaretli değil.' });
    }
    await this.coverageRepo.delete({ duty_slot_id: slot.id });
    slot.absent_marked_at = null;
    slot.absent_type = null;
    await this.slotRepo.save(slot);
    return { success: true };
  }

  /** Ek ders puantaj için devamsızlık özeti – gelmeyen işaretli slotlar */
  async getAbsencesForEkDers(schoolId: string | null, from: string, to: string) {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    const slots = await this.slotRepo
      .createQueryBuilder('s')
      .select(['s.user_id', 's.date', 's.absent_type'])
      .innerJoin('s.duty_plan', 'p')
      .where('p.school_id = :schoolId', { schoolId })
      .andWhere('p.deleted_at IS NULL')
      .andWhere('s.deleted_at IS NULL')
      .andWhere('s.absent_marked_at IS NOT NULL')
      .andWhere('s.date >= :from', { from })
      .andWhere('s.date <= :to', { to })
      .orderBy('s.date', 'ASC')
      .getMany();
    return {
      items: slots.map((s) => ({
        user_id: s.user_id,
        date: s.date,
        absent_type: s.absent_type || 'gelmeyen',
      })),
    };
  }

  /** Otomatik görevlendirme – tek tuşla plan oluştur */
  async autoGeneratePlan(
    schoolId: string | null,
    adminUserId: string,
    dto: {
      period_start: string;
      period_end: string;
      slots_per_day: number;
      area_names?: string[];
      version?: string;
      shifts?: ('morning' | 'afternoon')[] | string[];
      /** Haftalık maksimum nöbet sayısı (varsayılan: sınırsız) */
      max_per_week?: number;
      /** Kural toggle'ları (hepsi default: true/etkin) */
      prevent_consecutive_days?: boolean;
      respect_preferences?: boolean;
      enable_weekday_balance?: boolean;
      prefer_fewer_lessons_day?: boolean;
      /** Aylık maksimum nöbet sayısı (0 = sınırsız) */
      max_per_month?: number;
      /** Nöbetler arası min gün (0 = devre dışı) */
      min_days_between?: number;
      /** Her öğretmene her hafta aynı günde nöbet ver */
      same_day_each_week?: boolean;
      /** Öğretmene haftada kaç gün nöbet (1 veya 2); 1 = hep aynı 1 gün, 2 = hep aynı 2 gün */
      duty_days_per_week?: 1 | 2;
      /** Dönerli liste: İlk hafta şablon, sonraki haftalarda nöbet yerleri haftalık kaydırılır */
      rotate_area_by_week?: boolean;
    },
  ) {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });

    const toYmd = (d: Date): string => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    /** ISO hafta numarası (1-53) */
    const isoWeek = (ymd: string): string => {
      const d = new Date(ymd + 'T12:00:00');
      const jan4 = new Date(d.getFullYear(), 0, 4);
      const startOfWeek1 = new Date(jan4);
      startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
      const diff = d.getTime() - startOfWeek1.getTime();
      const week = Math.floor(diff / 604800000) + 1;
      return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
    };

    const school = await this.schoolRepo.findOne({
      where: { id: schoolId },
      select: ['duty_education_mode'],
    });
    const educationMode = (school?.duty_education_mode as 'single' | 'double' | null) === 'double' ? 'double' : 'single';
    const requestedShifts = Array.isArray(dto.shifts)
      ? [...new Set(dto.shifts.filter((s) => s === 'morning' || s === 'afternoon'))]
      : [];
    const shifts: ('morning' | 'afternoon')[] =
      requestedShifts.length > 0
        ? (requestedShifts as ('morning' | 'afternoon')[])
        : educationMode === 'double'
          ? ['morning', 'afternoon']
          : ['morning'];

    // Muaf öğretmenler (duty_exempt=true) otomatik planlamaya dahil edilmez
    const teachers = await this.listSchoolTeachers(schoolId, true);
    if (teachers.length === 0) {
      throw new BadRequestException({
        code: 'NO_TEACHERS',
        message: 'Nöbete atanabilecek öğretmen yok. Muaf olmayan aktif öğretmen bulunmuyor.',
      });
    }
    const areas = await this.listAreas(schoolId);
    const areaNames = dto.area_names?.length
      ? dto.area_names
      : areas.map((a) => a.name);
    if (areaNames.length === 0) areaNames.push('Genel');
    // Her alana en az 1 nöbetçi: DutyArea.slotsRequired toplamı kullanılır
    let areaAssignmentList = dto.area_names?.length
      ? (dto.area_names as string[]).flatMap((n) => [n])
      : areas.flatMap((a) => Array(Math.max(1, a.slotsRequired ?? 1)).fill(a.name) as string[]);
    const totalRequiredByAreas = areaAssignmentList.length || areaNames.length;
    const teacherCount = teachers.length;
    let priorityAreaExtendedMessage: string | undefined;
    if (teacherCount > totalRequiredByAreas && areas.length > 0 && !dto.area_names?.length) {
      const extraSlots = teacherCount - totalRequiredByAreas;
      const rotateAreaByWeekExtend = dto.rotate_area_by_week === true;
      if (rotateAreaByWeekExtend) {
        // Dönerli: öncelikli alanı döngüye ekle (ek slot da rotasyona girer, hep aynı yerde kalmaz)
        const extraPriorityArea = areas.find((a) => (a.sort_order ?? 0) === 1) ?? areas[0];
        areaAssignmentList = [...areaAssignmentList, extraPriorityArea.name];
        priorityAreaExtendedMessage = `Öğretmen sayısı (${teacherCount}) nöbet yerleri toplamından (${totalRequiredByAreas}) fazla. Öncelikli alan "${extraPriorityArea.name}" döngüye eklendi; ek slot da haftalık rotasyona girer. Tüm öğretmenler eşit nöbet alır.`;
      } else {
        // Normal: ek slotlar öncelikli alana verilir
        const extraPriorityArea = areas.find((a) => (a.sort_order ?? 0) === 1) ?? areas[0];
        const priorityAreaName = extraPriorityArea.name;
        areaAssignmentList = [...areaAssignmentList, ...Array(extraSlots).fill(priorityAreaName)];
        priorityAreaExtendedMessage = `Öğretmen sayısı (${teacherCount}) nöbet yeri toplamından (${totalRequiredByAreas}) fazla olduğu için öncelik değeri 1 olan alana "${priorityAreaName}" ${extraSlots} ek nöbet slotu eklendi. Tüm öğretmenler eşit nöbet alır.`;
      }
    }
    const effectiveSlotsFromAreas = areaAssignmentList.length;
    const slotsPerDay = Math.min(
      200,
      Math.max(
        effectiveSlotsFromAreas,
        typeof dto.slots_per_day === 'number' && dto.slots_per_day > 0 ? dto.slots_per_day : effectiveSlotsFromAreas,
      ),
    );

    // Öğretmene haftada kaç gün nöbet (1 = hep aynı 1 gün, 2 = hep aynı 2 gün)
    const dutyDaysPerWeek = dto.duty_days_per_week === 2 ? 2 : 1;
    // Haftalık limit: duty_days_per_week verilmişse ona göre; yoksa dto.max_per_week
    const maxPerWeek =
      typeof dto.max_per_week === 'number' && dto.max_per_week > 0
        ? dto.max_per_week
        : dutyDaysPerWeek;

    // Kural toggle'ları (undefined = varsayılan = etkin)
    const rulePreventConsecDays = dto.prevent_consecutive_days !== false;
    const ruleRespectPreferences = dto.respect_preferences !== false;
    const ruleWeekdayBalance = dto.enable_weekday_balance !== false;
    const ruleFewerLessonsDay = dto.prefer_fewer_lessons_day !== false;
    const maxPerMonth = typeof dto.max_per_month === 'number' && dto.max_per_month > 0 ? dto.max_per_month : 0;
    const minDaysBetween = typeof dto.min_days_between === 'number' && dto.min_days_between > 0 ? dto.min_days_between : 0;
    const rotateAreaByWeek = dto.rotate_area_by_week === true;
    // Dönerli: areaAssignmentList uzunluğu kullanılır (ek slot varsa öncelikli alan döngüye eklenmiştir)
    const slotsPerDayForRotation = rotateAreaByWeek ? areaAssignmentList.length : slotsPerDay;
    // duty_days_per_week kullanılıyorsa her hafta aynı gün(ler) zorunlu
    const ruleSameDayEachWeek = dto.same_day_each_week === true || dutyDaysPerWeek >= 1;

    // same_day_each_week: öğretmen → hafta 1'de atandığı gün (1-5 Mon-Fri); duty_days_per_week=2 için dizi
    const teacherPreferredWeekday = new Map<string, number>(); // userId → dayOfWeek (1 gün)
    const teacherPreferredWeekdays = new Map<string, number[]>(); // userId → [day1, day2] (2 gün modu)

    // Aylık nöbet sayısı sayacı (userId → YYYY-MM → count)
    const monthCountByUser = new Map<string, Map<string, number>>();
    for (const uid of (teachers as { id: string }[]).map((t) => t.id)) monthCountByUser.set(uid, new Map());

    const summary = await this.getSummary(schoolId, undefined, undefined);
    const countByUser = new Map<string, number>();
    for (const s of summary.items) {
      // Adil dağılım için ağırlıklı sayım kullan:
      // yerine görevlendirme lesson_count kadar ağırlık taşır → çok fazla karşılayan öğretmene daha az nöbet
      countByUser.set(s.user_id, s.weighted_count);
    }
    const from = dto.period_start?.trim();
    const to = dto.period_end?.trim();
    if (!from || !to) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'period_start ve period_end zorunludur.' });
    }
    if (from > to) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Başlangıç tarihi bitiş tarihinden büyük olamaz.' });
    }
    const startDate = new Date(from + 'T12:00:00');
    const endDate = new Date(to + 'T12:00:00');
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Tarih formatı geçersiz. YYYY-MM-DD olmalı.' });
    }
    const maxCalendarDays = 370;
    const calendarDays = Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
    if (calendarDays > maxCalendarDays) {
      throw new BadRequestException({ code: 'RANGE_TOO_LARGE', message: 'Tarih aralığı çok büyük. Lütfen aralığı daraltın.' });
    }

    // D: Tatil haftaları – work_calendar.isTatil = true olan haftalar planlanmaz
    const holidayCalendars = await this.workCalendarRepo
      .createQueryBuilder('wc')
      .select(['wc.week_start', 'wc.week_end'])
      .where('wc.is_tatil = true')
      .andWhere('wc.week_start <= :to', { to })
      .andWhere('wc.week_end >= :from', { from })
      .getMany();
    const holidayDates = new Set<string>();
    for (const wc of holidayCalendars) {
      const wStart = new Date((wc.weekStart as unknown as string) + 'T12:00:00');
      const wEnd = new Date((wc.weekEnd as unknown as string) + 'T12:00:00');
      for (let d = new Date(wStart); d <= wEnd; d.setDate(d.getDate() + 1)) {
        holidayDates.add(toYmd(d));
      }
    }

    // Pazartesi–Cuma, tatil dışı günler
    const dates: string[] = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const day = d.getDay();
      const ymd = toYmd(d);
      if (day >= 1 && day <= 5 && !holidayDates.has(ymd)) dates.push(ymd);
    }
    if (dates.length === 0) {
      throw new BadRequestException({ code: 'NO_WORK_DAYS', message: 'Seçilen aralıkta planlanabilir iş günü yok (hafta sonu ve tatil haftaları çıkarıldı).' });
    }
    const maxSlots = 3000;
    const effectiveMaxSlotsPerDay = rotateAreaByWeek ? areaAssignmentList.length : slotsPerDay;
    if (dates.length * effectiveMaxSlotsPerDay * Math.max(1, shifts.length) > maxSlots) {
      throw new BadRequestException({ code: 'TOO_MANY', message: 'Oluşturulacak nöbet sayısı çok fazla. Tarih aralığını veya günlük nöbet sayısını azaltın.' });
    }

    const teacherIds = teachers.map((t) => t.id);

    // Devamsızlıkları tek sorguda çek
    const absences = await this.absenceRepo
      .createQueryBuilder('a')
      .select(['a.user_id', 'a.date_from', 'a.date_to'])
      .where('a.school_id = :schoolId', { schoolId })
      .andWhere('a.user_id IN (:...userIds)', { userIds: teacherIds })
      .andWhere('a.date_from <= :to', { to })
      .andWhere('a.date_to >= :from', { from })
      .getMany();

    const dateSet = new Set(dates);
    const absentByDate = new Map<string, Set<string>>();
    for (const a of absences) {
      const aStart = new Date(a.date_from + 'T12:00:00');
      const aEnd = new Date(a.date_to + 'T12:00:00');
      for (let d = new Date(aStart); d <= aEnd; d.setDate(d.getDate() + 1)) {
        const ymd = toYmd(d);
        if (!dateSet.has(ymd)) continue;
        const set = absentByDate.get(ymd) ?? new Set<string>();
        set.add(a.user_id);
        absentByDate.set(ymd, set);
      }
    }

    // MEB Madde 91/a: Her öğretmen için gün bazlı ders sayısı (lessonCount per day)
    // Nöbet, ders sayısının en az olduğu güne tercih edilir.
    // dayLessonCount: userId → dayOfWeek(1-5) → lessonCount
    let dayLessonCount = new Map<string, Map<number, number>>();
    try {
      dayLessonCount = await this.timetableService.getLessonCountByDayForUsers(schoolId, teacherIds);
    } catch { /* ders programı yoksa görmezden gel */ }

    // A: Tercih verilerini tek sorguda çek (unavailable = engel, prefer/available = öncelik)
    // unavailable: her zaman dikkate al (öğretmen müsait değil dediyse atama yapma)
    // prefer + available: tercih/öncelik (Müsait, Tercih ediyorum, Dikkate alındı)
    const allPrefs = await this.prefRepo
      .createQueryBuilder('p')
      .select(['p.user_id', 'p.date', 'p.status', 'p.admin_confirmed_at'])
      .where('p.school_id = :schoolId', { schoolId })
      .andWhere('p.user_id IN (:...userIds)', { userIds: teacherIds })
      .andWhere('p.status IN (:...statuses)', { statuses: ['unavailable', 'prefer', 'available'] })
      .andWhere('p.date >= :from', { from })
      .andWhere('p.date <= :to', { to })
      .getMany();

    // Unavailable tercihler → absentByDate'e ekle (bu günde nöbet alamaz)
    // Prefer + Available tercihler → admin onaylı (Dikkate alındı) ve tümü (Müsait, Tercih ediyorum) planlamada öncelik
    const preferredMapConfirmed = new Map<string, Set<string>>(); // date → Set<userId> (Dikkate alındı)
    const preferredMapAny = new Map<string, Set<string>>(); // date → Set<userId> (Tercih ediyorum, onaylı veya değil)
    const toDateStr = (d: string | Date): string =>
      typeof d === 'string' ? d.slice(0, 10) : (d as Date).toISOString().slice(0, 10);
    for (const pref of allPrefs) {
      const d = toDateStr(pref.date);
      if (!dateSet.has(d)) continue;
      if (pref.status === 'unavailable') {
        const set = absentByDate.get(d) ?? new Set<string>();
        set.add(pref.user_id);
        absentByDate.set(d, set);
      } else if (pref.status === 'prefer' || pref.status === 'available') {
        const setAny = preferredMapAny.get(d) ?? new Set<string>();
        setAny.add(pref.user_id);
        preferredMapAny.set(d, setAny);
        if (pref.admin_confirmed_at) {
          const setConf = preferredMapConfirmed.get(d) ?? new Set<string>();
          setConf.add(pref.user_id);
          preferredMapConfirmed.set(d, setConf);
        }
      }
    }

    // Tercih günleri: userId → Set<weekday> (bu öğretmenin tercih ettiği hafta günleri; ardışık deprioritize için)
    const preferredWeekdaysByUser = new Map<string, Set<number>>();
    for (const uid of teacherIds) preferredWeekdaysByUser.set(uid, new Set());
    for (const [d, userIds] of preferredMapAny) {
      const wd = new Date(d + 'T12:00:00').getDay();
      if (wd >= 1 && wd <= 5) for (const uid of userIds) preferredWeekdaysByUser.get(uid)?.add(wd);
    }

    // F: Haftalık nöbet sayısı sayacı (userId → weekKey → count)
    const weekCountByUser = new Map<string, Map<string, number>>();
    for (const uid of teacherIds) weekCountByUser.set(uid, new Map());

    // G: Ardışık gün önleme — son nöbet tarihi (min_days_between için) + bu planda atanan hafta günleri seti
    const lastDutyDateByUser = new Map<string, string>();
    /** Bu planda öğretmenin atandığı hafta günleri (1–5); ardışıklık kontrolü tüm günlere göre yapılır. */
    const assignedWeekdaysByUser = new Map<string, Set<number>>();
    for (const uid of teacherIds) assignedWeekdaysByUser.set(uid, new Set());
    // Mevcut DB'deki son nöbet tarihlerini çek; ayrıca o tarihin hafta gününü set'e ekle (ardışıklık için)
    const prevSlots = await this.slotRepo
      .createQueryBuilder('s')
      .select(['s.user_id', 'MAX(s.date) as last_date'])
      .innerJoin('s.duty_plan', 'p')
      .where('p.school_id = :schoolId', { schoolId })
      .andWhere('p.status = :status', { status: 'published' })
      .andWhere('s.user_id IN (:...ids)', { ids: teacherIds })
      .groupBy('s.user_id')
      .getRawMany();
    for (const row of prevSlots) {
      lastDutyDateByUser.set(row.user_id, row.last_date);
    }

    // H: Haftanın günü bazlı dengelenmiş dağılım — weekday sayacı (userId → dayOfWeek → count)
    // Aynı öğretmen hep aynı güne gitmemesi için hafif ceza uygular.
    const weekdayCountByUser = new Map<string, Map<number, number>>();
    for (const uid of teacherIds) weekdayCountByUser.set(uid, new Map());

    // I: Haftalık gün takibi – same_day_each_week hard filter ve "haftada iki farklı güne nöbet verme" kuralı
    // userId → weekKey → dayOfWeek (ilk atandığı gün)
    const weekDayAssignedByUser = new Map<string, Map<string, number>>();
    for (const uid of teacherIds) weekDayAssignedByUser.set(uid, new Map());

    const slots: { date: string; shift: 'morning' | 'afternoon'; user_id: string; area_name: string }[] = [];
    // Hafta günü (getDay): 1 Pzt, 2 Sal, 3 Çar, 4 Per, 5 Cum. Ardışık = (1,2),(2,3),(3,4),(4,5),(5,1).
    const getWorkDay = (dateStr: string): number => {
      const d = new Date(dateStr + 'T12:00:00').getDay();
      return d >= 1 && d <= 5 ? d : 0; // 0 = hafta sonu / geçersiz
    };
    const areConsecutiveWeekdays = (wd1: number, wd2: number): boolean => {
      if (wd1 < 1 || wd1 > 5 || wd2 < 1 || wd2 > 5) return false;
      const diff = (wd2 - wd1 + 5) % 5;
      return diff === 1 || diff === 4; // bitişik: sonraki veya önceki gün (Cum–Pzt dahil)
    };
    // Ardışık çalışma günü: tarih değil hafta gününe göre (Salı+Çarşamba farklı haftalarda olsa bile ardışık sayılır)
    const areConsecutiveWorkDays = (d1: string, d2: string): boolean =>
      areConsecutiveWeekdays(getWorkDay(d1), getWorkDay(d2));
    const getNextWorkDayAfter = (dateStr: string): string => {
      const d = new Date(dateStr + 'T12:00:00');
      const day = d.getDay();
      const addDays = day === 5 ? 3 : day === 6 ? 2 : 1;
      d.setDate(d.getDate() + addDays);
      return d.toISOString().slice(0, 10);
    };
    /** Ardışık olur mu: (1) bu planda atanan hafta günleriyle, (2) önceki plandaki son nöbet tarihiyle (Cuma→Pzt) */
    const wouldBeConsecutive = (uid: string, currentWd: number, currentDate: string): boolean => {
      const set = assignedWeekdaysByUser.get(uid);
      if (set?.size) for (const w of set) if (areConsecutiveWeekdays(w, currentWd)) return true;
      const lastDate = lastDutyDateByUser.get(uid);
      if (lastDate && getNextWorkDayAfter(lastDate) === currentDate) return true;
      return false;
    };

    // Gün bazlı slot sayacı – en az dolu güne önce atama (Pzt 9 / Sal 5 eşitsizliği önlenir)
    const weekdaySlotCount = new Map<number, number>();
    for (let wd = 1; wd <= 5; wd++) weekdaySlotCount.set(wd, 0);
    // Dönerli liste: hafta indeksine göre nöbet yeri kaydırma (ilk hafta şablon, sonraki haftalar bir kayar)
    // Takvim haftası bazlı (Pzt-Paz): her takvim haftası aynı weekIndex, böylece tüm öğretmenler aynı haftada aynı rotasyonda
    const toYmdLocal = (d: Date): string => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    const getMondayOfWeek = (ymd: string): string => {
      const d = new Date(ymd + 'T12:00:00');
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      d.setDate(d.getDate() + diff);
      return toYmdLocal(d);
    };
    const getAreaIdxForDate = (slotIndex: number, dateStr: string): number => {
      const L = areaAssignmentList.length;
      const baseIdx = slotIndex % L;
      if (!rotateAreaByWeek) return baseIdx;
      const refMonday = getMondayOfWeek(from);
      const dateMonday = getMondayOfWeek(dateStr);
      const refMs = new Date(refMonday + 'T12:00:00').getTime();
      const dateMs = new Date(dateMonday + 'T12:00:00').getTime();
      const weekIndex = Math.max(0, Math.floor((dateMs - refMs) / (7 * 86400000)));
      // Son yerden sonra ilk yere geç: (baseIdx + weekIndex) % L → L-1'den sonra 0
      return (baseIdx + weekIndex) % L;
    };
    // Round-robin: slot bazlı + en az dolu gün önceliği
    // Dönerli modda slotsPerDayForRotation = areaAssignmentList.length (nöbetçi sayısına uyum)
    const loopSlotsPerDay = rotateAreaByWeek ? slotsPerDayForRotation : slotsPerDay;
    for (const sh of shifts) {
      for (let i = 0; i < loopSlotsPerDay; i++) {
        // Tarihleri gün bazlı mevcut sayıya göre sırala – en az dolu gün önce (kurallara sıkı uyum)
        const datesSorted = [...dates].sort((a, b) => {
          const dayA = new Date(a + 'T12:00:00').getDay() || 7;
          const dayB = new Date(b + 'T12:00:00').getDay() || 7;
          const cntA = weekdaySlotCount.get(dayA) ?? 0;
          const cntB = weekdaySlotCount.get(dayB) ?? 0;
          if (cntA !== cntB) return cntA - cntB;
          return a.localeCompare(b);
        });
        for (const date of datesSorted) {
          const weekKey = isoWeek(date);
          const dayOfWeek = new Date(date + 'T12:00:00').getDay() || 7; // 0=Pazar→7, 1-5=Pzt-Cum
          const absentIds = absentByDate.get(date) ?? new Set<string>();
          const preferredIdsConfirmed = preferredMapConfirmed.get(date) ?? new Set<string>();
          const preferredIdsAny = preferredMapAny.get(date) ?? new Set<string>();
          // B: Aynı gün ve vardiyaya zaten atananları tut (çift atama engeli)
          const assignedToday = new Set<string>(
            slots.filter((s) => s.date === date && s.shift === sh).map((s) => s.user_id),
          );

          const available = teacherIds.filter((uid) => {
            if (absentIds.has(uid)) return false;
            if (assignedToday.has(uid)) return false;
            if (maxPerWeek > 0) {
              const wc = weekCountByUser.get(uid)?.get(weekKey) ?? 0;
              if (wc >= maxPerWeek) return false;
            }
            if (maxPerMonth > 0) {
              const monthKey = date.slice(0, 7);
              const mc = monthCountByUser.get(uid)?.get(monthKey) ?? 0;
              if (mc >= maxPerMonth) return false;
            }
            return true;
          });

          // I: same_day_each_week / duty_days_per_week → bu hafta atanmış gün(ler) veya tercih günü(ler) ile eşleşmeli
          let candidatePoolPreSoft = available;
          if (ruleSameDayEachWeek) {
            const sameDay = available.filter((uid) => {
              const weekCount = weekCountByUser.get(uid)?.get(weekKey) ?? 0;
              if (dutyDaysPerWeek === 2) {
                const preferredDays = teacherPreferredWeekdays.get(uid) ?? [];
                if (weekCount >= 2) return false;
                if (preferredDays.length === 0) return true;
                if (preferredDays.length === 2 && !preferredDays.includes(dayOfWeek)) return false;
                if (preferredDays.length === 1) {
                  if (preferredDays.includes(dayOfWeek)) return true;
                  if (areConsecutiveWeekdays(preferredDays[0]!, dayOfWeek)) return false;
                  return true;
                }
                return preferredDays.includes(dayOfWeek);
              }
              const assignedDayThisWeek = weekDayAssignedByUser.get(uid)?.get(weekKey);
              if (assignedDayThisWeek !== undefined && assignedDayThisWeek !== dayOfWeek) return false;
              const prefDay = teacherPreferredWeekday.get(uid);
              if (prefDay !== undefined && prefDay !== dayOfWeek) return false;
              return true;
            });
            if (sameDay.length > 0) candidatePoolPreSoft = sameDay;
          }

          // Tercih günü ayırma: tercih ettiği güne ardışık günlere atamayı engelle (Pzt tercih → Salı/Cum'a atama yapma)
          const currentWd = getWorkDay(date);
          const candidatePoolForDay = ruleRespectPreferences
            ? candidatePoolPreSoft.filter((uid) => {
                const pw = preferredWeekdaysByUser.get(uid);
                if (!pw?.size) return true;
                if (pw.has(currentWd)) return true;
                for (const w of pw) if (areConsecutiveWeekdays(w, currentWd)) return false;
                return true;
              })
            : candidatePoolPreSoft;

          // min_days_between: sert kural – ihlal edenler asla atanmaz (MEB vb.)
          // prevent_consecutive: atanan tüm hafta günlerine göre; bu güne atanırsa ardışık olur mu?
          const availableFiltered = candidatePoolForDay.filter((uid) => {
            const lastDate = lastDutyDateByUser.get(uid);
            if (lastDate) {
              const lastD = new Date(lastDate + 'T12:00:00');
              const curD = new Date(date + 'T12:00:00');
              const diffDays = Math.round((curD.getTime() - lastD.getTime()) / 86400000);
              if (minDaysBetween > 0 && diffDays < minDaysBetween) return false;
            }
            if (rulePreventConsecDays && wouldBeConsecutive(uid, currentWd, date)) return false;
            return true;
          });
          // Tercih güçlendirme: "Tercih ediyorum" olanlar eklenebilir; ardışık gün önleme açıksa ASLA ihlal edenler eklenmez.
          // min_days_between ihlal edenler ASLA preferOverride'a alınmaz (sert kural).
          const preferOverride =
            ruleRespectPreferences && minDaysBetween === 0
              ? candidatePoolForDay.filter((uid) => {
                  if (!preferredIdsAny.has(uid) || availableFiltered.includes(uid)) return false;
                  if (rulePreventConsecDays && wouldBeConsecutive(uid, currentWd, date)) return false;
                  return true;
                })
              : ruleRespectPreferences
                ? candidatePoolForDay.filter((uid) => {
                    if (!preferredIdsAny.has(uid) || availableFiltered.includes(uid)) return false;
                    if (rulePreventConsecDays && wouldBeConsecutive(uid, currentWd, date)) return false;
                    const lastDate = lastDutyDateByUser.get(uid);
                    if (!lastDate) return true;
                    const diffDays = Math.round(
                      (new Date(date + 'T12:00:00').getTime() - new Date(lastDate + 'T12:00:00').getTime()) / 86400000,
                    );
                    return diffDays >= minDaysBetween;
                  })
                : [];
          // Fallback: availableFiltered boşsa min_days_between geçenler kullanılır; ardışık gün ihlal edenler atanmaz
          const lastResortPoolRaw =
            minDaysBetween > 0
              ? candidatePoolForDay.filter((uid) => {
                  const lastDate = lastDutyDateByUser.get(uid);
                  if (!lastDate) return true;
                  const diffDays = Math.round(
                    (new Date(date + 'T12:00:00').getTime() - new Date(lastDate + 'T12:00:00').getTime()) / 86400000,
                  );
                  return diffDays >= minDaysBetween;
                })
              : candidatePoolForDay;
          const lastResortPool = rulePreventConsecDays
            ? lastResortPoolRaw.filter((uid) => !wouldBeConsecutive(uid, currentWd, date))
            : lastResortPoolRaw;
          let candidatePool =
            availableFiltered.length > 0
              ? [...preferOverride, ...availableFiltered]
              : [...preferOverride, ...lastResortPool];
          // Her güne her nöbet yeri sayısı kadar nöbetçi: candidatePool boşsa bile atanabilecek (müsait + o gün atanmamış) öğretmenlerle zorla doldur
          if (candidatePool.length === 0) {
            const forcePool = teacherIds.filter(
              (uid) => {
                if (absentIds.has(uid) || assignedToday.has(uid)) return false;
                if (maxPerWeek > 0 && (weekCountByUser.get(uid)?.get(weekKey) ?? 0) >= maxPerWeek) return false;
                if (maxPerMonth > 0 && (monthCountByUser.get(uid)?.get(date.slice(0, 7)) ?? 0) >= maxPerMonth) return false;
                if (rulePreventConsecDays && wouldBeConsecutive(uid, getWorkDay(date), date)) return false;
                if (ruleRespectPreferences) {
                  const pw = preferredWeekdaysByUser.get(uid);
                  if (pw?.size && !pw.has(currentWd))
                    for (const w of pw) if (areConsecutiveWeekdays(w, currentWd)) return false;
                }
                return true;
              },
            );
            candidatePool = forcePool;
          }
          if (candidatePool.length === 0) continue;

          // --- Sıralama: çok kriterli adil dağılım ---
          const sorted = [...candidatePool].sort((a, b) => {
            // 0. same_day_each_week / duty_days_per_week: bu gün öğretmenin tercih günü(ler)inden mi?
            if (ruleSameDayEachWeek) {
              if (dutyDaysPerWeek === 2) {
                const daysA = teacherPreferredWeekdays.get(a) ?? [];
                const daysB = teacherPreferredWeekdays.get(b) ?? [];
                const matchA = daysA.includes(dayOfWeek) ? 0 : daysA.length < 2 ? 1 : 2;
                const matchB = daysB.includes(dayOfWeek) ? 0 : daysB.length < 2 ? 1 : 2;
                if (matchA !== matchB) return matchA - matchB;
              } else {
                const prefDayA = teacherPreferredWeekday.get(a);
                const prefDayB = teacherPreferredWeekday.get(b);
                if (prefDayA !== undefined || prefDayB !== undefined) {
                  const matchA = prefDayA === dayOfWeek ? 0 : prefDayA === undefined ? 1 : 2;
                  const matchB = prefDayB === dayOfWeek ? 0 : prefDayB === undefined ? 1 : 2;
                  if (matchA !== matchB) return matchA - matchB;
                }
              }
            }

            // 1. Öğretmen istekleri: Dikkate alındı (0), Tercih ediyorum bu tarih (1), yok (2), tercih gününe ardışık günde kullanmayı geciktir (3)
            if (ruleRespectPreferences) {
              const depriorA = ((): number => {
                if (preferredIdsConfirmed.has(a)) return 0;
                if (preferredIdsAny.has(a)) return 1;
                const prefWdA = preferredWeekdaysByUser.get(a);
                if (prefWdA?.size && !prefWdA.has(dayOfWeek)) {
                  for (const w of prefWdA) if (areConsecutiveWeekdays(w, dayOfWeek)) return 3;
                }
                return 2;
              })();
              const depriorB = ((): number => {
                if (preferredIdsConfirmed.has(b)) return 0;
                if (preferredIdsAny.has(b)) return 1;
                const prefWdB = preferredWeekdaysByUser.get(b);
                if (prefWdB?.size && !prefWdB.has(dayOfWeek)) {
                  for (const w of prefWdB) if (areConsecutiveWeekdays(w, dayOfWeek)) return 3;
                }
                return 2;
              })();
              if (depriorA !== depriorB) return depriorA - depriorB;
            }

            // 2. Ardışık çalışma günü cezası: bu güne atanırsa atanmış olduğu bir günle ardışık mı? (tercih günü önceliği 1. maddede)
            if (rulePreventConsecDays) {
              const isConsecA = wouldBeConsecutive(a, currentWd, date);
              const isConsecB = wouldBeConsecutive(b, currentWd, date);
              if (isConsecA !== isConsecB) return isConsecA ? 1 : -1;
            }

            // 3. MEB Madde 91/a: O günün ders sayısı az olan önce – rule toggle
            if (ruleFewerLessonsDay) {
              const lessonsA = dayLessonCount.get(a)?.get(dayOfWeek) ?? 0;
              const lessonsB = dayLessonCount.get(b)?.get(dayOfWeek) ?? 0;
              if (lessonsA !== lessonsB) return lessonsA - lessonsB;
            }

            // 4. Bu haftanın günü için en az dağıtım (Pzt hep aynı kişi değil) – rule toggle
            if (ruleWeekdayBalance && !ruleSameDayEachWeek) {
              const wdA = weekdayCountByUser.get(a)?.get(dayOfWeek) ?? 0;
              const wdB = weekdayCountByUser.get(b)?.get(dayOfWeek) ?? 0;
              if (wdA !== wdB) return wdA - wdB;
            }

            // 5. Dönem toplam weighted_count en az olan önce
            return (countByUser.get(a) ?? 0) - (countByUser.get(b) ?? 0);
          });

          const uid = sorted[0]!;
          const effectiveAreaIdx = getAreaIdxForDate(i, date);
          slots.push({ date, shift: sh, user_id: uid, area_name: areaAssignmentList[effectiveAreaIdx] });
          weekdaySlotCount.set(dayOfWeek, (weekdaySlotCount.get(dayOfWeek) ?? 0) + 1);
          countByUser.set(uid, (countByUser.get(uid) ?? 0) + 1);
          assignedToday.add(uid);
          lastDutyDateByUser.set(uid, date); // G: son nöbet tarihini güncelle
          if (currentWd >= 1 && currentWd <= 5) assignedWeekdaysByUser.get(uid)?.add(currentWd);
          // same_day_each_week: hafta 1'de öğretmenin tercih gününü kaydet (1 veya 2 gün)
          if (ruleSameDayEachWeek) {
            if (dutyDaysPerWeek === 2) {
              const arr = teacherPreferredWeekdays.get(uid) ?? [];
              if (!arr.includes(dayOfWeek) && arr.length < 2) {
                if (arr.length === 0 || !areConsecutiveWeekdays(arr[0]!, dayOfWeek)) {
                  arr.push(dayOfWeek);
                  arr.sort((x, y) => x - y);
                  teacherPreferredWeekdays.set(uid, arr);
                }
              }
            } else if (!teacherPreferredWeekday.has(uid)) {
              teacherPreferredWeekday.set(uid, dayOfWeek);
            }
          }
          // I: Haftalık gün takibini güncelle (sadece ilk atama bu hafta için kayıt; 2 gün modunda ikinci günü ekleme)
          const userWeekDayMap = weekDayAssignedByUser.get(uid) ?? new Map<string, number>();
          weekDayAssignedByUser.set(uid, userWeekDayMap);
          if (!userWeekDayMap.has(weekKey)) {
            userWeekDayMap.set(weekKey, dayOfWeek);
          }
          // H: hafta günü sayacını güncelle
          const wdMap = weekdayCountByUser.get(uid) ?? new Map<number, number>();
          weekdayCountByUser.set(uid, wdMap);
          wdMap.set(dayOfWeek, (wdMap.get(dayOfWeek) ?? 0) + 1);
          // F: haftalık sayacı güncelle
          const userWeekMap = weekCountByUser.get(uid) ?? new Map<string, number>();
          weekCountByUser.set(uid, userWeekMap);
          userWeekMap.set(weekKey, (userWeekMap.get(weekKey) ?? 0) + 1);
          // Aylık sayacı güncelle
          if (maxPerMonth > 0) {
            const monthKey = date.slice(0, 7);
            const userMonthMap = monthCountByUser.get(uid) ?? new Map<string, number>();
            monthCountByUser.set(uid, userMonthMap);
            userMonthMap.set(monthKey, (userMonthMap.get(monthKey) ?? 0) + 1);
          }
        }
      }
    }
    const planDto: CreateDutyPlanDto = {
      version: dto.version?.trim() || `Otomatik ${from}–${to}`,
      period_start: from,
      period_end: to,
      slots: slots.map((s) => ({
        date: s.date,
        shift: s.shift,
        user_id: s.user_id,
        area_name: s.area_name,
      })),
    };
    const plan = await this.createPlan(schoolId, adminUserId, planDto);

    // Dağıtım raporu: öğretmen → gün bazlı nöbet sayıları
    const DAY_NAMES = ['', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
    const distributionMap = new Map<string, { display_name: string | null; email: string; weekday_counts: Record<number, number>; total: number }>();
    for (const s of slots) {
      const wd = new Date(s.date + 'T12:00:00').getDay() || 7;
      if (!distributionMap.has(s.user_id)) {
        const t = teachers.find((tc) => tc.id === s.user_id);
        distributionMap.set(s.user_id, {
          display_name: (t as { display_name?: string | null })?.display_name ?? null,
          email: (t as { email?: string })?.email ?? '',
          weekday_counts: {},
          total: 0,
        });
      }
      const entry = distributionMap.get(s.user_id)!;
      entry.weekday_counts[wd] = (entry.weekday_counts[wd] ?? 0) + 1;
      entry.total += 1;
    }
    const distribution = [...distributionMap.entries()].map(([user_id, d]) => ({
      user_id,
      display_name: d.display_name,
      email: d.email,
      weekday_counts: d.weekday_counts,
      weekday_labels: Object.fromEntries(
        Object.entries(d.weekday_counts).map(([wd, cnt]) => [DAY_NAMES[Number(wd)] ?? wd, cnt])
      ),
      total: d.total,
    })).sort((a, b) => b.total - a.total);

    const totalSlotsPossible = dates.length * loopSlotsPerDay * shifts.length;
    const totalAssigned = slots.length;
    const warning: string | null =
      totalAssigned < totalSlotsPossible
        ? `Nöbet sayısı yetersiz: ${totalAssigned} atama yapıldı, ${totalSlotsPossible} slot hedeflendi. Öğretmen sayısını artırın, haftalık gün sayısını (${dutyDaysPerWeek}) veya günlük nöbet sayısını gözden geçirin. Oluşan planı el ile düzenleyebilirsiniz.`
        : null;

    return { ...plan, distribution, warning, priority_area_extended: priorityAreaExtendedMessage ?? null };
  }

  // ─── DERS SAATİ BAZLI COVERAGE ──────────────────────────────────────────────

  /**
   * Bir slot'un coverage durumunu döndür:
   * - Her ders saati için: atanmış öğretmen + öneri listesi
   */
  async getCoverageStatus(duty_slot_id: string, schoolId: string | null) {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    const slot = await this.slotRepo.findOne({ where: { id: duty_slot_id }, relations: ['duty_plan', 'user'] });
    if (!slot) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Nöbet kaydı bulunamadı.' });
    if (slot.duty_plan.school_id !== schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });

    const coverages = await this.coverageRepo.find({
      where: { duty_slot_id: slot.id },
      order: { lesson_num: 'ASC' },
    });

    // Atanmış öğretmen bilgilerini toplu çek
    const assignedIds = coverages.map((c) => c.covered_by_user_id).filter(Boolean) as string[];
    const assignedUsers = assignedIds.length
      ? await this.userRepo.find({
          where: { id: In(assignedIds) },
          select: ['id', 'display_name', 'email'],
        })
      : [];
    const assignedMap = new Map(assignedUsers.map((u) => [u.id, u]));

    // O gün nöbetçi olan öğretmenler (coverage için aday havuzu)
    const dayDutySlots = await this.getSlotsForDate(schoolId, slot.date, UserRole.school_admin, undefined, slot.shift);
    const dutyUserIds = [...new Set(dayDutySlots.filter((s) => s.user_id !== slot.user_id).map((s) => s.user_id))];

    // Her ders için boş öğretmen önerileri
    const lessonSuggestions: Record<number, { user_id: string; display_name: string | null; email: string; free_lesson_count: number }[]> = {};
    for (const cov of coverages) {
      if (!cov.covered_by_user_id) {
        try {
          const suggestions = await this.timetableService.suggestReplacement(
            schoolId, slot.date, dutyUserIds, cov.lesson_num, slot.user_id,
          );
          lessonSuggestions[cov.lesson_num] = suggestions.slice(0, 5);
        } catch {
          lessonSuggestions[cov.lesson_num] = [];
        }
      }
    }

    return {
      duty_slot_id: slot.id,
      absent_teacher: {
        user_id: slot.user_id,
        display_name: slot.user?.display_name ?? null,
        email: slot.user?.email ?? '',
      },
      date: slot.date,
      coverages: coverages.map((c) => ({
        id: c.id,
        lesson_num: c.lesson_num,
        covered_by_user_id: c.covered_by_user_id,
        covered_by: c.covered_by_user_id ? (assignedMap.get(c.covered_by_user_id) ?? null) : null,
        suggestions: lessonSuggestions[c.lesson_num] ?? [],
      })),
      all_assigned: coverages.length > 0 && coverages.every((c) => !!c.covered_by_user_id),
      pending_count: coverages.filter((c) => !c.covered_by_user_id).length,
    };
  }

  /**
   * Belirli bir ders saati için öğretmen ata (veya değiştir).
   */
  async assignCoverage(
    duty_slot_id: string,
    lesson_num: number,
    user_id: string,
    schoolId: string | null,
    performedBy: string,
  ) {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    await this.validateTeachersInSchool(schoolId, [user_id]);

    const slot = await this.slotRepo.findOne({ where: { id: duty_slot_id }, relations: ['duty_plan'] });
    if (!slot) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Nöbet kaydı bulunamadı.' });
    if (slot.duty_plan.school_id !== schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });

    // Yalnızca o günkü nöbetçilere görevlendirme yapılabilir
    const dayDutySlots = await this.getSlotsForDate(schoolId, slot.date, UserRole.school_admin);
    const dutyUserIds = new Set(dayDutySlots.filter((s) => s.user_id !== slot.user_id).map((s) => s.user_id));
    if (!dutyUserIds.has(user_id)) {
      throw new BadRequestException({ code: 'NOT_ON_DUTY', message: 'Bu öğretmen o gün nöbetçi değil. Görevlendirme sadece o günkü nöbetçilere yapılabilir.' });
    }

    // Mevcut coverage kaydını bul ya da oluştur
    let coverage = await this.coverageRepo.findOne({ where: { duty_slot_id, lesson_num } });
    if (!coverage) {
      coverage = this.coverageRepo.create({ duty_slot_id, lesson_num, covered_by_user_id: null, note: null });
    }

    const prevUserId = coverage.covered_by_user_id;
    coverage.covered_by_user_id = user_id;
    await this.coverageRepo.save(coverage);

    // Log
    await this.logRepo.save(this.logRepo.create({
      school_id: schoolId,
      action: 'coverage_assigned',
      duty_slot_id: slot.id,
      old_user_id: prevUserId,
      new_user_id: user_id,
      performed_by: performedBy,
    }));

    // Görevlendirilen öğretmene anında bildirim
    const dateLabel = slot.date
      ? new Date(slot.date + 'T12:00:00').toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })
      : '';
    await this.notificationsService.createInboxEntry({
      user_id: user_id,
      event_type: 'duty.coverage_assigned',
      entity_id: slot.id,
      target_screen: 'nobet',
      title: 'Ders Görevi Atandı',
      body: dateLabel ? `${dateLabel} tarihinde ${lesson_num}. ders için ders göreviniz atandı. Günlük listeyi görüntüleyin.` : `${lesson_num}. ders için ders göreviniz atandı.`,
      metadata: slot.date ? { date: slot.date } : null,
    });

    return { success: true, coverage };
  }

  /**
   * Tüm atanmamış coverage kayıtlarını otomatik en uygun öğretmenlere ata.
   *
   * Adil dağılım kriterleri (öncelik sırasıyla):
   *  1. O ders saatinde dersi olmayan öğretmen (timetable filtresi)
   *  2. Bugün bu slot için atanan coverage sayısı en az (günde max 2 limit)
   *  3. DB'deki toplam coverage_lesson_count en az (geçmiş dönem adilliği)
   *  4. Genel weighted_count en az (toplam nöbet yükü)
   *  5. Boş ders saati sayısı en fazla (en rahat öğretmen)
   *
   * Eşit dağılım garantisi: Aday havuzu round-robin sırayla dağıtılır —
   * 4 ders + 4 nöbetçi varsa her nöbetçi tam 1 ders alır.
   */
  async autoAssignCoverages(
    duty_slot_id: string,
    schoolId: string | null,
    performedBy: string,
    /** Bir öğretmenin aynı günde alabileceği max coverage (varsayılan: 2) */
    maxPerDay = 2,
  ) {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    const slot = await this.slotRepo.findOne({ where: { id: duty_slot_id }, relations: ['duty_plan'] });
    if (!slot) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Nöbet kaydı bulunamadı.' });
    if (slot.duty_plan.school_id !== schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });

    const pending = await this.coverageRepo.find({
      where: { duty_slot_id, covered_by_user_id: IsNull() },
      order: { lesson_num: 'ASC' },
    });
    if (pending.length === 0) return { success: true, assigned: 0, message: 'Tüm ders saatleri zaten atanmış.' };

    const dayDutySlots = await this.getSlotsForDate(schoolId, slot.date, UserRole.school_admin, undefined, slot.shift);
    const dutyUserIds = [...new Set(dayDutySlots.filter((s) => s.user_id !== slot.user_id).map((s) => s.user_id))];

    // --- 1. Kalıcı adil dağılım: DB'den dönem geneli coverage sayımı ---
    const covSummaryRows = await this.coverageRepo
      .createQueryBuilder('c')
      .select('c.covered_by_user_id', 'uid')
      .addSelect('COUNT(*)::int', 'cnt')
      .innerJoin('c.duty_slot', 's')
      .innerJoin('s.duty_plan', 'p')
      .where('p.school_id = :schoolId', { schoolId })
      .andWhere('c.covered_by_user_id IN (:...dutyUserIds)', { dutyUserIds: dutyUserIds.length ? dutyUserIds : ['__none__'] })
      .groupBy('c.covered_by_user_id')
      .getRawMany();
    const dbCoverageCount = new Map<string, number>(covSummaryRows.map((r) => [r.uid, Number(r.cnt) || 0]));

    // Adil dağılım sadece Ders Görevi Sıralamasına (coverage) göre; weighted_count kullanılmıyor

    // --- 3. Bu gün (bu slot dışındaki) atanmış coverage sayısı ---
    const todayCovRows = await this.coverageRepo
      .createQueryBuilder('c')
      .select('c.covered_by_user_id', 'uid')
      .addSelect('COUNT(*)::int', 'cnt')
      .innerJoin('c.duty_slot', 's')
      .innerJoin('s.duty_plan', 'p')
      .where('p.school_id = :schoolId', { schoolId })
      .andWhere('s.date = :date', { date: slot.date })
      .andWhere('c.covered_by_user_id IS NOT NULL')
      .andWhere('c.duty_slot_id != :slotId', { slotId: slot.id })
      .andWhere('c.covered_by_user_id IN (:...dutyUserIds)', { dutyUserIds: dutyUserIds.length ? dutyUserIds : ['__none__'] })
      .groupBy('c.covered_by_user_id')
      .getRawMany();
    // Bu session'da eklenenler de dahil edilecek (aşağıda artar)
    const todayCount = new Map<string, number>(todayCovRows.map((r) => [r.uid, Number(r.cnt) || 0]));

    // --- Eşit dağılım için round-robin sıra takibi ---
    // Bu session'daki atama sayısı (birden fazla ders varsa aynı kişiye gitmemesi için)
    const sessionCount = new Map<string, number>();

    const assigned: number[] = [];
    const dateLabel = new Date(slot.date + 'T12:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

    for (const cov of pending) {
      try {
        const suggestions = await this.timetableService.suggestReplacement(
          schoolId, slot.date, dutyUserIds, cov.lesson_num, slot.user_id,
        );

        // Günlük maks. limiti geçmemiş adayları filtrele
        const eligible = suggestions.filter((s) => {
          const todayTotal = (todayCount.get(s.user_id) ?? 0) + (sessionCount.get(s.user_id) ?? 0);
          return todayTotal < maxPerDay;
        });

        // Sıralama: Sadece Ders Görevi (görevlendirme) – adil dağılım kriteri
        const best = (eligible.length > 0 ? eligible : suggestions).sort((a, b) => {
          // a) DB'de döneme kadar en az ders görevi alan önce (ADİL DAĞILIM – tek kriter)
          const da = dbCoverageCount.get(a.user_id) ?? 0;
          const db = dbCoverageCount.get(b.user_id) ?? 0;
          if (da !== db) return da - db;
          // b) Bu session'da en az coverage alan önce (round-robin aynı DB count için)
          const sa = sessionCount.get(a.user_id) ?? 0;
          const sb = sessionCount.get(b.user_id) ?? 0;
          if (sa !== sb) return sa - sb;
          // c) Boş ders saati en fazla olan önce (en rahat)
          return b.free_lesson_count - a.free_lesson_count;
        })[0];

        if (best) {
          cov.covered_by_user_id = best.user_id;
          await this.coverageRepo.save(cov);
          sessionCount.set(best.user_id, (sessionCount.get(best.user_id) ?? 0) + 1);
          dbCoverageCount.set(best.user_id, (dbCoverageCount.get(best.user_id) ?? 0) + 1);
          assigned.push(cov.lesson_num);

          await this.logRepo.save(this.logRepo.create({
            school_id: schoolId,
            action: 'coverage_assigned',
            duty_slot_id: slot.id,
            old_user_id: null,
            new_user_id: best.user_id,
            performed_by: performedBy,
          }));
          // Görevlendirilen öğretmene anında bildirim
          await this.notificationsService.createInboxEntry({
            user_id: best.user_id,
            event_type: 'duty.coverage_assigned',
            entity_id: slot.id,
            target_screen: 'nobet',
            title: 'Ders Görevi Atandı',
            body: `${dateLabel} tarihinde ${cov.lesson_num}. ders için ders göreviniz atandı. Günlük listeyi görüntüleyin.`,
            metadata: slot.date ? { date: slot.date } : null,
          });
        }
      } catch { /* ders programı yoksa atla */ }
    }

    return {
      success: true,
      assigned,
      assigned_count: assigned.length,
      pending_count: pending.length - assigned.length,
    };
  }

  /**
   * Coverage kaydını sil (atamayı geri al).
   */
  async removeCoverage(coverage_id: string, schoolId: string | null) {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    const cov = await this.coverageRepo.findOne({
      where: { id: coverage_id },
      relations: ['duty_slot', 'duty_slot.duty_plan'],
    });
    if (!cov) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Coverage kaydı bulunamadı.' });
    if (cov.duty_slot.duty_plan.school_id !== schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    cov.covered_by_user_id = null;
    await this.coverageRepo.save(cov);
    return { success: true };
  }

  /**
   * Belirli tarihte görev atanan öğretmenlere bildirim gönder (toplu, el ile tetiklenen).
   * school_admin tarafından kullanılır. Nöbetçilere + coverage atanan öğretmenlere bildirim.
   */
  async sendDailyNotifications(schoolId: string | null, date: string) {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });

    const slots = await this.getSlotsForDate(schoolId, date, UserRole.school_admin);
    const coverages = await this.coverageRepo
      .createQueryBuilder('c')
      .innerJoin('c.duty_slot', 's')
      .innerJoin('s.duty_plan', 'p')
      .where('p.school_id = :schoolId', { schoolId })
      .andWhere('s.date = :date', { date })
      .andWhere('c.covered_by_user_id IS NOT NULL')
      .getMany();

    const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });
    let sent = 0;

    // Nöbet slotlarındaki öğretmenlere bildirim
    const dutyUserIds = [...new Set(slots.filter((s) => !s.absent_marked_at).map((s) => s.user_id))];
    for (const uid of dutyUserIds) {
      const mySlot = slots.find((s) => s.user_id === uid);
      const area = mySlot?.area_name ? ` (${mySlot.area_name})` : '';
      await this.notificationsService.createInboxEntry({
        user_id: uid,
        event_type: 'duty.reminder',
        entity_id: mySlot?.id ?? uid,
        target_screen: 'nobet',
        title: 'Nöbet Hatırlatması',
        body: `${dateLabel} tarihinde${area} nöbetiniz var. Günlük listeyi görüntüleyin.`,
        metadata: { date },
      });
      sent++;
    }

    // Coverage atanan öğretmenlere bildirim
    for (const cov of coverages) {
      if (!cov.covered_by_user_id) continue;
      await this.notificationsService.createInboxEntry({
        user_id: cov.covered_by_user_id,
        event_type: 'duty.coverage_assigned',
        entity_id: cov.duty_slot_id,
        target_screen: 'nobet',
        title: 'Ders Görevi Hatırlatması',
        body: `${dateLabel} tarihinde ${cov.lesson_num}. ders için ders göreviniz var. Günlük listeyi görüntüleyin.`,
        metadata: { date },
      });
      sent++;
    }

    return { success: true, sent, date };
  }

  /**
   * Son 24 saat içindeki bir log kaydını geri al.
   * Desteklenen action'lar: reassign, absent_marked, coverage_assigned, duty_exempt_set/cleared
   */
  async undoAction(logId: string, schoolId: string | null, performedByUserId: string) {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    const log = await this.logRepo.findOne({ where: { id: logId } });
    if (!log) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Log kaydı bulunamadı.' });
    if (log.school_id !== schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    if (log.undone_at) throw new BadRequestException({ code: 'ALREADY_UNDONE', message: 'Bu işlem zaten geri alındı.' });

    const ageMs = Date.now() - new Date(log.created_at).getTime();
    if (ageMs > 24 * 60 * 60 * 1000) {
      throw new BadRequestException({ code: 'TOO_OLD', message: 'Bu işlem 24 saatten eski, geri alınamaz.' });
    }

    switch (log.action) {
      case 'reassign': {
        if (!log.duty_slot_id || !log.old_user_id) {
          throw new BadRequestException({ code: 'UNDO_ERROR', message: 'Geri alma için gerekli bilgiler eksik.' });
        }
        const slot = await this.slotRepo.findOne({ where: { id: log.duty_slot_id } });
        if (!slot) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Nöbet slotu bulunamadı.' });
        slot.user_id = log.old_user_id;
        slot.reassigned_from_user_id = null;
        await this.slotRepo.save(slot);
        break;
      }
      case 'absent_marked': {
        if (!log.duty_slot_id) {
          throw new BadRequestException({ code: 'UNDO_ERROR', message: 'Geri alma için gerekli bilgiler eksik.' });
        }
        const slot = await this.slotRepo.findOne({ where: { id: log.duty_slot_id } });
        if (!slot) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Nöbet slotu bulunamadı.' });
        slot.absent_marked_at = null;
        slot.absent_type = null;
        await this.slotRepo.save(slot);
        await this.coverageRepo.delete({ duty_slot_id: log.duty_slot_id });
        break;
      }
      case 'coverage_assigned': {
        if (!log.duty_slot_id || !log.new_user_id) {
          throw new BadRequestException({ code: 'UNDO_ERROR', message: 'Geri alma için gerekli bilgiler eksik.' });
        }
        const coverage = await this.coverageRepo.findOne({
          where: { duty_slot_id: log.duty_slot_id, covered_by_user_id: log.new_user_id },
        });
        if (coverage) {
          coverage.covered_by_user_id = null;
          await this.coverageRepo.save(coverage);
        }
        break;
      }
      case 'duty_exempt_set':
      case 'duty_exempt_cleared': {
        if (!log.old_user_id) {
          throw new BadRequestException({ code: 'UNDO_ERROR', message: 'Geri alma için gerekli bilgiler eksik.' });
        }
        const user = await this.userRepo.findOne({ where: { id: log.old_user_id } });
        if (!user) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Kullanıcı bulunamadı.' });
        user.dutyExempt = log.action === 'duty_exempt_cleared';
        await this.userRepo.save(user);
        break;
      }
      default:
        throw new BadRequestException({ code: 'UNDO_UNSUPPORTED', message: `'${log.action}' action tipi geri alınamaz.` });
    }

    log.undone_at = new Date();
    log.undone_by = performedByUserId;
    await this.logRepo.save(log);
    return { success: true, log_id: logId, action: log.action };
  }

  /**
   * Devamsızlık kaydı için öğretmenin tarih aralığındaki ders programını döndürür.
   * Boş geçecek dersler: öğretmenin o günkü dersleri → coverage sistemine alınacak.
   */
  async getAbsenceClassSchedule(absenceId: string, schoolId: string | null) {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    const absence = await this.absenceRepo.findOne({ where: { id: absenceId }, relations: ['user'] });
    if (!absence) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Devamsızlık kaydı bulunamadı.' });
    if (absence.school_id !== schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu kaydı görme yetkiniz yok.' });

    const toYmd = (d: Date): string => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const start = new Date(absence.date_from + 'T12:00:00');
    const end = new Date(absence.date_to + 'T12:00:00');
    const dates: { date: string; day_of_week: number }[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay();
      if (dow >= 1 && dow <= 5) {
        dates.push({ date: toYmd(d), day_of_week: dow });
      }
    }

    const byDate = await this.timetableService.getByDate(schoolId, absence.date_from);
    const lessonsByDay = new Map<number, { lesson_num: number; class_section: string; subject: string }[]>();

    // Grup ders programını gün bazlı hesapla (day_of_week 1-5)
    for (const { date, day_of_week } of dates) {
      if (!lessonsByDay.has(day_of_week)) {
        const dayByDate = await this.timetableService.getByDate(schoolId, date);
        const teacherLessons = dayByDate[absence.user_id] ?? {};
        const lessons = Object.entries(teacherLessons).map(([ln, val]) => ({
          lesson_num: parseInt(ln, 10),
          class_section: val.class_section,
          subject: val.subject,
        })).sort((a, b) => a.lesson_num - b.lesson_num);
        lessonsByDay.set(day_of_week, lessons);
      }
    }

    const result = dates.map(({ date, day_of_week }) => ({
      date,
      day_of_week,
      lessons: lessonsByDay.get(day_of_week) ?? [],
    }));

    return {
      absence_id: absenceId,
      user_id: absence.user_id,
      teacher_name: absence.user?.display_name ?? absence.user?.email ?? null,
      date_from: absence.date_from,
      date_to: absence.date_to,
      dates: result,
    };
  }

  /** Tarih aralığında atanmış ders saati bazlı görevlendirmeler – Görevlendirmeler sayfası için */
  async getCoverageAssignments(schoolId: string | null, from: string, to: string) {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    const items = await this.coverageRepo
      .createQueryBuilder('c')
      .innerJoinAndSelect('c.duty_slot', 's')
      .innerJoin('s.duty_plan', 'p')
      .leftJoinAndSelect('s.user', 'slotUser')
      .leftJoinAndSelect('s.reassignedFromUser', 'rfu')
      .leftJoinAndSelect('c.covered_by_user', 'cu')
      .where('p.school_id = :schoolId', { schoolId })
      .andWhere('p.status = :status', { status: 'published' })
      .andWhere('s.deleted_at IS NULL')
      .andWhere('s.absent_marked_at IS NOT NULL')
      .andWhere('c.covered_by_user_id IS NOT NULL')
      .andWhere('s.date >= :from', { from })
      .andWhere('s.date <= :to', { to })
      .orderBy('s.date', 'ASC')
      .addOrderBy('c.lesson_num', 'ASC')
      .getMany();

    return items.map((c) => ({
      id: c.id,
      duty_slot_id: c.duty_slot_id,
      lesson_num: c.lesson_num,
      date: c.duty_slot?.date,
      area_name: c.duty_slot?.area_name ?? null,
      shift: c.duty_slot?.shift ?? 'morning',
      absent_type: c.duty_slot?.absent_type ?? 'gelmeyen',
      absent_teacher: (c.duty_slot?.reassigned_from_user_id && c.duty_slot?.reassignedFromUser)
        ? { id: c.duty_slot.reassigned_from_user_id, display_name: c.duty_slot.reassignedFromUser.display_name, email: c.duty_slot.reassignedFromUser.email }
        : c.duty_slot?.user
          ? { id: c.duty_slot.user_id, display_name: c.duty_slot.user.display_name, email: c.duty_slot.user.email }
          : null,
      covered_by_user: c.covered_by_user
        ? { id: c.covered_by_user.id, display_name: c.covered_by_user.display_name, email: c.covered_by_user.email }
        : null,
    }));
  }

  async getCoveragesForDate(schoolId: string | null, date: string) {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    const items = await this.coverageRepo
      .createQueryBuilder('c')
      .innerJoinAndSelect('c.duty_slot', 's')
      .innerJoin('s.duty_plan', 'p')
      .leftJoinAndSelect('s.user', 'slotUser')
      .leftJoinAndSelect('c.covered_by_user', 'cu')
      .where('p.school_id = :schoolId', { schoolId })
      .andWhere('s.date = :date', { date })
      .andWhere('p.status = :status', { status: 'published' })
      .andWhere('s.deleted_at IS NULL')
      .orderBy('c.lesson_num', 'ASC')
      .getMany();
    return this.mapCoveragesWithSlot(items);
  }

  /** Tarih aralığında coverage kayıtları (ders görevi değişimi için) */
  async getCoveragesForDateRange(schoolId: string | null, from: string, to: string) {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    const items = await this.coverageRepo
      .createQueryBuilder('c')
      .innerJoinAndSelect('c.duty_slot', 's')
      .innerJoin('s.duty_plan', 'p')
      .leftJoinAndSelect('s.user', 'slotUser')
      .leftJoinAndSelect('c.covered_by_user', 'cu')
      .where('p.school_id = :schoolId', { schoolId })
      .andWhere('s.date >= :from', { from })
      .andWhere('s.date <= :to', { to })
      .andWhere('p.status = :status', { status: 'published' })
      .andWhere('s.deleted_at IS NULL')
      .orderBy('s.date', 'ASC')
      .addOrderBy('c.lesson_num', 'ASC')
      .getMany();
    return this.mapCoveragesWithSlot(items);
  }

  private mapCoveragesWithSlot(
    items: DutyCoverage[],
  ): Array<{
    id: string;
    duty_slot_id: string;
    lesson_num: number;
    covered_by_user_id: string | null;
    covered_by_user: { id: string; display_name: string | null; email: string } | null;
    duty_slot?: { date: string; area_name: string | null; user?: { display_name: string | null; email: string } };
  }> {
    return items.map((c) => ({
      id: c.id,
      duty_slot_id: c.duty_slot_id,
      lesson_num: c.lesson_num,
      covered_by_user_id: c.covered_by_user_id,
      covered_by_user: c.covered_by_user
        ? { id: c.covered_by_user.id, display_name: c.covered_by_user.display_name, email: c.covered_by_user.email }
        : null,
      duty_slot: c.duty_slot
        ? {
            date: c.duty_slot.date,
            area_name: c.duty_slot.area_name ?? null,
            user: c.duty_slot.user
              ? { display_name: c.duty_slot.user.display_name, email: c.duty_slot.user.email }
              : undefined,
          }
        : undefined,
    }));
  }

  /**
   * Nöbetçi Öğretmen Boş Ders Görevlendirme formatı için veri.
   * Gün seçilince o güne ait gelmeyen ve yerine görevlendirilen öğretmenleri döner.
   * GET /duty/bos-ders-teblig?date=YYYY-MM-DD
   */
  async getBosDersTeblig(schoolId: string | null, date: string) {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });

    const [school, tl] = await Promise.all([
      this.schoolRepo.findOne({ where: { id: schoolId }, select: ['duty_max_lessons'] }),
      this.timetableService.getMaxLessons(schoolId),
    ]);
    const maxLessons = Math.min(12, Math.max(6, school?.duty_max_lessons ?? tl ?? 10));

    const d = new Date(date + 'T12:00:00');
    const dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    const dateLabel = `${d.getDate()} ${d.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })} ${dayNames[d.getDay()]}`;

    // Timetable: absent teacher -> lesson_num -> { class_section, subject }
    const timetableByUser = await this.timetableService.getByDate(schoolId, date);

    // 1. Absent slots with lesson-level coverage
    const coverageItems = await this.coverageRepo
      .createQueryBuilder('c')
      .innerJoinAndSelect('c.duty_slot', 's')
      .innerJoin('s.duty_plan', 'p')
      .leftJoinAndSelect('s.user', 'slotUser')
      .leftJoinAndSelect('s.reassignedFromUser', 'rfu')
      .leftJoinAndSelect('c.covered_by_user', 'cu')
      .where('p.school_id = :schoolId', { schoolId })
      .andWhere('p.status = :status', { status: 'published' })
      .andWhere('s.deleted_at IS NULL')
      .andWhere('s.date = :date', { date })
      .andWhere('s.absent_marked_at IS NOT NULL')
      .orderBy('c.lesson_num', 'ASC')
      .getMany();

    // 2. Reassigned slots (tüm gün yerine görevlendirme – coverage yok)
    const reassignedSlots = await this.slotRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.user', 'u')
      .leftJoinAndSelect('s.reassignedFromUser', 'rfu')
      .innerJoin('s.duty_plan', 'p')
      .where('p.school_id = :schoolId', { schoolId })
      .andWhere('p.status = :status', { status: 'published' })
      .andWhere('s.deleted_at IS NULL')
      .andWhere('s.date = :date', { date })
      .andWhere('s.reassigned_from_user_id IS NOT NULL')
      .getMany();

    const name = (u: { display_name: string | null; email: string } | null | undefined) =>
      u?.display_name?.trim() || u?.email || '—';

    type GelmeyenRow = { teacher_id: string; teacher_name: string; absent_type: string; lessons: Record<number, string> };
    type GorevlendirilenRow = { teacher_id: string; teacher_name: string; lessons: Record<number, string> };

    const gelmeyenMap = new Map<string, GelmeyenRow>();
    const gorevlendirilenMap = new Map<string, GorevlendirilenRow>();

    const initLessons = () => Object.fromEntries(Array.from({ length: maxLessons }, (_, i) => [i + 1, '—']));

    const absentTypeLabel: Record<string, string> = {
      raporlu: 'Raporlu',
      izinli: 'İzinli',
      gelmeyen: 'Gelmeyen',
    };

    // Coverage'dan gelmeyen ve görevlendirilen satırları doldur
    for (const c of coverageItems) {
      const slot = c.duty_slot;
      const absent = slot?.reassigned_from_user_id && slot?.reassignedFromUser
        ? slot.reassignedFromUser
        : slot?.user;
      const coveredBy = c.covered_by_user;
      if (!absent) continue;

      const absentId = String(absent.id ?? slot?.user_id ?? '');
      const absentName = name(absent);
      const absentType = absentTypeLabel[slot?.absent_type ?? ''] || slot?.absent_type || 'Gelmeyen';
      const tblForAbsent = timetableByUser[absentId] ?? timetableByUser[String(slot?.user_id)] ?? {};

      if (!gelmeyenMap.has(absentId)) {
        gelmeyenMap.set(absentId, {
          teacher_id: absentId,
          teacher_name: absentName,
          absent_type: absentType,
          lessons: initLessons(),
        });
      }
      const gr = gelmeyenMap.get(absentId)!;
      if (c.lesson_num >= 1 && c.lesson_num <= maxLessons) {
        const cell = tblForAbsent[c.lesson_num];
        gr.lessons[c.lesson_num] = cell?.class_section?.trim() || (coveredBy ? '✓' : gr.lessons[c.lesson_num]);
      }

      if (coveredBy) {
        const covId = coveredBy.id;
        const covName = name(coveredBy);
        if (!gorevlendirilenMap.has(covId)) {
          gorevlendirilenMap.set(covId, {
            teacher_id: covId,
            teacher_name: covName,
            lessons: initLessons(),
          });
        }
        const covr = gorevlendirilenMap.get(covId)!;
        if (c.lesson_num >= 1 && c.lesson_num <= maxLessons) {
          covr.lessons[c.lesson_num] = absentName;
        }
      }
    }

    // Reassigned (tüm gün): gelmeyen = reassignedFromUser, görevlendirilen = user
    for (const slot of reassignedSlots) {
      const absent = slot.reassignedFromUser;
      const covering = slot.user;
      if (!absent || !covering) continue;

      const absentId = String(absent.id ?? slot.reassigned_from_user_id ?? '');
      const absentName = name(absent);
      const covId = covering.id;
      const covName = name(covering);

      if (!gelmeyenMap.has(absentId)) {
        gelmeyenMap.set(absentId, {
          teacher_id: absentId,
          teacher_name: absentName,
          absent_type: 'Yerine görevlendirildi',
          lessons: initLessons(),
        });
      }
      const gr = gelmeyenMap.get(absentId)!;
      const absentTimetable = timetableByUser[absentId] ?? timetableByUser[String(slot.reassigned_from_user_id)] ?? {};
      for (let i = 1; i <= maxLessons; i++) {
        const cell = absentTimetable[i];
        gr.lessons[i] = cell?.class_section?.trim() || '✓';
      }

      if (!gorevlendirilenMap.has(covId)) {
        gorevlendirilenMap.set(covId, {
          teacher_id: covId,
          teacher_name: covName,
          lessons: initLessons(),
        });
      }
      const covr = gorevlendirilenMap.get(covId)!;
      for (let i = 1; i <= maxLessons; i++) {
        covr.lessons[i] = absentName;
      }
    }

    // Gelmeyen satırlarında timetable'dan sınıf adlarını doldur (varsa "✓" veya "—" yerine sınıf adı)
    for (const gr of gelmeyenMap.values()) {
      const tbl = timetableByUser[gr.teacher_id] ?? {};
      for (let i = 1; i <= maxLessons; i++) {
        const cell = tbl[i];
        if (cell?.class_section?.trim()) {
          gr.lessons[i] = cell.class_section.trim();
        }
      }
    }

    return {
      date,
      date_label: dateLabel,
      day_name: dayNames[d.getDay()].toUpperCase(),
      max_lessons: maxLessons,
      gelmeyenler: Array.from(gelmeyenMap.values()),
      gorevlendirilenler: Array.from(gorevlendirilenMap.values()),
    };
  }

  /**
   * Haftalık nöbet çizelgesi – günler ve nöbet yerleri tablosu.
   * GET /duty/haftalik-cizelge?weekStart=YYYY-MM-DD
   */
  async getHaftalikCizelge(schoolId: string | null, weekStart: string) {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    const start = new Date(weekStart + 'T12:00:00');
    const dayOfWeek = start.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(start);
    monday.setDate(start.getDate() + mondayOffset);
    const from = monday.toISOString().slice(0, 10);
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    const to = friday.toISOString().slice(0, 10);

    const school = await this.schoolRepo.findOne({
      where: { id: schoolId },
      select: ['duty_education_mode', 'duty_teblig_haftalik_duty_duties_text'],
    });
    const educationMode = (school?.duty_education_mode as 'single' | 'double' | null) === 'double' ? 'double' : 'single';
    const shiftFilter = educationMode === 'single' ? 'morning' : undefined;

    const slots = await this.getSlotsForDateRange(
      schoolId,
      from,
      to,
      UserRole.school_admin,
      undefined,
      shiftFilter,
    );

    const dayNames = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma'];
    const name = (u: { display_name?: string | null; email?: string; teacherBranch?: string | null } | null | undefined) =>
      u?.display_name?.trim() || u?.email || '—';
    const teacherMap = new Map<string, { name: string; branch: string | null }>();
    const areasSet = new Set<string>();
    const byDateArea = new Map<string, Map<string, string[]>>();
    const byDateShiftArea = new Map<string, Map<string, Map<string, string[]>>>();

    for (const s of slots) {
      const date = s.date;
      const shift = (s.shift ?? 'morning') as 'morning' | 'afternoon';
      const area = s.area_name?.trim() || 'Genel';
      areasSet.add(area);
      const teacherName = name(s.user);
      if (s.user?.id && !teacherMap.has(s.user.id)) {
        teacherMap.set(s.user.id, { name: teacherName, branch: s.user.teacherBranch?.trim() || null });
      }
      if (educationMode === 'double') {
        if (!byDateShiftArea.has(date)) byDateShiftArea.set(date, new Map());
        const shiftMap = byDateShiftArea.get(date)!;
        if (!shiftMap.has(shift)) shiftMap.set(shift, new Map());
        const areaMap = shiftMap.get(shift)!;
        if (!areaMap.has(area)) areaMap.set(area, []);
        areaMap.get(area)!.push(teacherName);
      } else {
        if (!byDateArea.has(date)) byDateArea.set(date, new Map());
        const areaMap = byDateArea.get(date)!;
        if (!areaMap.has(area)) areaMap.set(area, []);
        areaMap.get(area)!.push(teacherName);
      }
    }

    const areas = Array.from(areasSet).sort();
    const days: { date: string; day_name: string; row: Record<string, string>; morning?: Record<string, string>; afternoon?: Record<string, string> }[] = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      if (educationMode === 'double') {
        const shiftMap = byDateShiftArea.get(dateStr) ?? new Map();
        const morningMap = shiftMap.get('morning') ?? new Map();
        const afternoonMap = shiftMap.get('afternoon') ?? new Map();
        const morning: Record<string, string> = {};
        const afternoon: Record<string, string> = {};
        const row: Record<string, string> = {};
        for (const a of areas) {
          morning[a] = (morningMap.get(a) ?? []).join('\n');
          afternoon[a] = (afternoonMap.get(a) ?? []).join('\n');
          row[a] = [morning[a], afternoon[a]].filter(Boolean).join('\n') || '—';
        }
        days.push({ date: dateStr, day_name: dayNames[i], row, morning, afternoon });
      } else {
        const areaMap = byDateArea.get(dateStr) ?? new Map();
        const row: Record<string, string> = {};
        for (const a of areas) {
          const names = areaMap.get(a) ?? [];
          row[a] = names.join('\n');
        }
        days.push({ date: dateStr, day_name: dayNames[i], row });
      }
    }

    const DEFAULT_DUTY_DUTIES = `1- Günlük vakit çizelgesini uygulamak.
2- Öğretmenlerin derslere zamanında girip girmediğini izlemek ve öğretmeni gelmeyen sınıfları okul yönetimine bildirmek ve bu sınıflara nezaret etmek.
3- Isıtma, elektrik ve sıhhi tesislerin çalışıp çalışmadığını, okul içi temizliğin yapılıp yapılmadığını, okul bina ve tesislerinin yangından koruma önlemlerinin alınıp alınmadığının günlük kontrollerini yapmak, giderilebildiği eksikleri gidermek, gerekli olanları ilgililere duyurmak.
4- Bahçedeki, koridorlardaki ve sınıflardaki öğrencileri gözetlemek.
5- Beklenmedik olaylar karşısında gerekli tedbirleri almak ve bu durumu ilgililere bildirmek.
6- Nöbet süresince okulun eğitim öğretim disiplin gibi çeşitli işlerini izlemek, bu hususlarda günlük tedbirleri almak.
7- Nöbet sonunda okul nöbet defterine nöbet süresi içerisinde önemli olayları ve aldığı tedbirleri belirten raporu yazmak.
8- Nöbet görevi sabah saat 08:30'da başlar, akşam 16:45'de sona erer.`;
    const duty_duties_text = (school?.duty_teblig_haftalik_duty_duties_text?.trim() || DEFAULT_DUTY_DUTIES).trim();
    const teachers = Array.from(teacherMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    return {
      week_start: from,
      education_mode: educationMode,
      areas,
      days,
      duty_duties_text,
      teachers,
    };
  }

  /**
   * Aylık nöbet çizelgesi – ay/yıl bazlı tablo (Sabah/Öğlen vardiyalı).
   * GET /duty/aylik-cizelge?month=9&year=2025
   */
  async getAylikCizelge(schoolId: string | null, month: number, year: number) {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    if (month < 1 || month > 12) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Geçersiz ay.' });
    const from = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0);
    const to = lastDay.toISOString().slice(0, 10);

    const school = await this.schoolRepo.findOne({
      where: { id: schoolId },
      select: ['name', 'district', 'principalName', 'duty_education_mode'],
    });
    const educationMode = (school?.duty_education_mode as 'single' | 'double' | null) === 'double' ? 'double' : 'single';

    const slots = await this.getSlotsForDateRange(
      schoolId,
      from,
      to,
      UserRole.school_admin,
      undefined,
      undefined,
    );

    const dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    const name = (u: { display_name?: string | null; email?: string } | null | undefined) =>
      u?.display_name?.trim() || u?.email || '—';

    const areasSet = new Set<string>();
    const byDateShiftArea = new Map<string, Map<string, Map<string, string[]>>>();

    for (const s of slots) {
      const date = s.date;
      const shift = (s.shift ?? 'morning') as 'morning' | 'afternoon';
      const area = s.area_name?.trim() || 'Genel';
      areasSet.add(area);
      if (!byDateShiftArea.has(date)) byDateShiftArea.set(date, new Map());
      const shiftMap = byDateShiftArea.get(date)!;
      if (!shiftMap.has(shift)) shiftMap.set(shift, new Map());
      const areaMap = shiftMap.get(shift)!;
      if (!areaMap.has(area)) areaMap.set(area, []);
      const teacherName = name(s.user);
      areaMap.get(area)!.push(teacherName);
    }

    const areas = Array.from(areasSet).sort();
    const dates: { date: string; day_name: string; morning: Record<string, string>; afternoon: Record<string, string> }[] = [];
    const current = new Date(from + 'T12:00:00');
    const end = new Date(to + 'T12:00:00');

    while (current <= end) {
      const dateStr = current.toISOString().slice(0, 10);
      const dayOfWeek = current.getDay();
      const dayName = dayNames[dayOfWeek];
      const shiftMap = byDateShiftArea.get(dateStr) ?? new Map();
      const morningMap = shiftMap.get('morning') ?? new Map();
      const afternoonMap = shiftMap.get('afternoon') ?? new Map();

      const morning: Record<string, string> = {};
      const afternoon: Record<string, string> = {};
      for (const a of areas) {
        morning[a] = (morningMap.get(a) ?? []).join('\n');
        afternoon[a] = (afternoonMap.get(a) ?? []).join('\n');
      }

      dates.push({ date: dateStr, day_name: dayName, morning, afternoon });
      current.setDate(current.getDate() + 1);
    }

    return {
      school_name: school?.name ?? '',
      school_district: school?.district ?? null,
      principal_name: school?.principalName ?? null,
      month,
      year,
      education_mode: educationMode,
      areas,
      dates,
    };
  }
}
