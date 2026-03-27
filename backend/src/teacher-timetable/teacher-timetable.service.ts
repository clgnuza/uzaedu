import { Injectable, ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as os from 'os';
import { TeacherTimetable } from './entities/teacher-timetable.entity';
import { TeacherPersonalProgram } from './entities/teacher-personal-program.entity';
import { TeacherPersonalProgramEntry } from './entities/teacher-personal-program-entry.entity';
import { SchoolTimetablePlan } from './entities/school-timetable-plan.entity';
import { SchoolTimetablePlanEntry } from './entities/school-timetable-plan-entry.entity';
import { User } from '../users/entities/user.entity';
import { School } from '../schools/entities/school.entity';
import { NotificationsService } from '../notifications/notifications.service';

const DAY_ALIASES: Record<string, number> = {
  '1': 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  pzt: 1,
  pazartesi: 1,
  sal: 2,
  salı: 2,
  car: 3,
  çarşamba: 3,
  carsamba: 3,
  per: 4,
  persembe: 4,
  cum: 5,
  cuma: 5,
};

export interface TimetableEntry {
  day_of_week: number;
  lesson_num: number;
  user_id: string;
  class_section: string;
  subject: string;
}

export interface UploadResult {
  imported: number;
  errors: string[];
  plan_id?: string;
}

export interface TimetablePlanDto {
  id: string;
  name: string | null;
  valid_from: string;
  valid_until: string | null;
  status: string;
  published_at: string | null;
  academic_year: string | null;
  created_at: string;
  entry_count: number;
}

export interface PersonalProgramDto {
  id: string;
  name: string;
  academic_year: string;
  term: string;
  total_hours: number;
  created_at: string;
  updated_at: string;
}

export interface PersonalProgramWithEntriesDto extends PersonalProgramDto {
  entries: TimetableEntry[];
}

@Injectable()
export class TeacherTimetableService {
  constructor(
    @InjectRepository(TeacherTimetable)
    private readonly repo: Repository<TeacherTimetable>,
    @InjectRepository(TeacherPersonalProgram)
    private readonly personalProgramRepo: Repository<TeacherPersonalProgram>,
    @InjectRepository(TeacherPersonalProgramEntry)
    private readonly personalEntryRepo: Repository<TeacherPersonalProgramEntry>,
    @InjectRepository(SchoolTimetablePlan)
    private readonly planRepo: Repository<SchoolTimetablePlan>,
    @InjectRepository(SchoolTimetablePlanEntry)
    private readonly planEntryRepo: Repository<SchoolTimetablePlanEntry>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(School)
    private readonly schoolRepo: Repository<School>,
    private readonly notificationsService: NotificationsService,
  ) {}

  /** Okulun Nöbet/Ders Programı ayarlarındaki max ders saati (6–12). Yoksa 8. */
  async getSchoolConfigMaxLessons(schoolId: string): Promise<number> {
    const school = await this.schoolRepo.findOne({
      where: { id: schoolId },
      select: ['duty_max_lessons', 'duty_education_mode'],
    });
    const n = school?.duty_max_lessons;
    if (n != null && n >= 6 && n <= 12) return n;
    return 8;
  }

  /** Tarih için geçerli plan id (yayınlanmış, valid_from <= date, valid_until null veya >= date). Yoksa null. */
  private async getActivePlanIdForDate(schoolId: string, date: string): Promise<string | null> {
    const plan = await this.planRepo
      .createQueryBuilder('p')
      .select('p.id')
      .where('p.school_id = :schoolId', { schoolId })
      .andWhere('p.status = :status', { status: 'published' })
      .andWhere('p.valid_from <= :date', { date })
      .andWhere('(p.valid_until IS NULL OR p.valid_until >= :date)', { date })
      .orderBy('p.valid_from', 'DESC')
      .getOne();
    return plan?.id ?? null;
  }

  /** Tarih için geçerli plan bilgisi (yayınlanmış). valid_until null = açık uçlu. */
  async getActivePlanInfo(schoolId: string | null, date?: string): Promise<{ plan_id: string; name: string | null; valid_from: string; valid_until: string | null } | null> {
    if (!schoolId) return null;
    const dateStr = (date ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
    const plan = await this.planRepo
      .createQueryBuilder('p')
      .select(['p.id', 'p.name', 'p.valid_from', 'p.valid_until'])
      .where('p.school_id = :schoolId', { schoolId })
      .andWhere('p.status = :status', { status: 'published' })
      .andWhere('p.valid_from <= :date', { date: dateStr })
      .andWhere('(p.valid_until IS NULL OR p.valid_until >= :date)', { date: dateStr })
      .orderBy('p.valid_from', 'DESC')
      .getOne();
    return plan ? { plan_id: plan.id, name: plan.name, valid_from: plan.valid_from, valid_until: plan.valid_until } : null;
  }

  async getBySchool(schoolId: string | null, date?: string): Promise<TimetableEntry[]> {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    const dateStr = (date ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
    const planId = await this.getActivePlanIdForDate(schoolId, dateStr);
    const where: Record<string, unknown> = { school_id: schoolId };
    if (planId) {
      where.plan_id = planId;
    } else {
      where.plan_id = null;
    }
    const rows = await this.repo.find({
      where,
      select: ['day_of_week', 'lesson_num', 'user_id', 'class_section', 'subject'],
      order: { day_of_week: 'ASC', lesson_num: 'ASC', class_section: 'ASC' },
    });
    return rows.map((r) => ({
      day_of_week: r.day_of_week,
      lesson_num: r.lesson_num,
      user_id: r.user_id,
      class_section: r.class_section,
      subject: r.subject,
    }));
  }

  /** Öğretmenin kendi ders programı (scope: sadece kendi user_id). */
  async getByMe(schoolId: string | null, userId: string, date?: string): Promise<TimetableEntry[]> {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    const dateStr = (date ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
    const planId = await this.getActivePlanIdForDate(schoolId, dateStr);
    const where: Record<string, unknown> = { school_id: schoolId, user_id: userId };
    if (planId) {
      where.plan_id = planId;
    } else {
      where.plan_id = null;
    }
    const rows = await this.repo.find({
      where,
      select: ['day_of_week', 'lesson_num', 'user_id', 'class_section', 'subject'],
      order: { day_of_week: 'ASC', lesson_num: 'ASC', class_section: 'ASC' },
    });
    return rows.map((r) => ({
      day_of_week: r.day_of_week,
      lesson_num: r.lesson_num,
      user_id: r.user_id,
      class_section: r.class_section,
      subject: r.subject,
    }));
  }

  /** Tarih için gün numarası (Pzt=1 … Cum=5). Cumartesi=6, Pazar=7 – ders yok. */
  getDayOfWeekFromDate(dateStr: string): number {
    const d = new Date(dateStr + 'T12:00:00');
    const n = d.getDay(); // 0=Pazar, 1=Pzt, …, 6=Cmt
    return n === 0 ? 7 : n;
  }

  /** user_id -> lesson_num -> { class_section, subject } */
  async getByDate(schoolId: string | null, date: string): Promise<Record<string, Record<number, { class_section: string; subject: string }>>> {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    const dateStr = date.slice(0, 10);
    const planId = await this.getActivePlanIdForDate(schoolId, dateStr);
    const dayOfWeek = this.getDayOfWeekFromDate(dateStr);
    const turkishDay = dayOfWeek >= 1 && dayOfWeek <= 5 ? dayOfWeek : 1;
    const where: Record<string, unknown> = { school_id: schoolId, day_of_week: turkishDay };
    if (planId) where.plan_id = planId;
    else where.plan_id = null;
    const rows = await this.repo.find({
      where,
      select: ['user_id', 'lesson_num', 'class_section', 'subject'],
    });
    const out: Record<string, Record<number, { class_section: string; subject: string }>> = {};
    for (const r of rows) {
      const uid = String(r.user_id ?? '');
      if (!uid) continue;
      if (!out[uid]) out[uid] = {};
      out[uid][r.lesson_num] = { class_section: r.class_section?.trim() ?? '', subject: r.subject ?? '' };
    }
    return out;
  }

  /**
   * Sınıf + ders saati için slot bilgisi (Akıllı Tahta: ders programından otomatik).
   * Cumartesi/Pazar için null.
   */
  async getSlotByClassSection(
    schoolId: string,
    date: string,
    classSection: string,
    lessonNum: number,
  ): Promise<{ user_id: string; subject: string; teacher_name: string } | null> {
    const dateStr = date.slice(0, 10);
    const dayOfWeek = this.getDayOfWeekFromDate(dateStr);
    if (dayOfWeek < 1 || dayOfWeek > 5) return null;
    const planId = await this.getActivePlanIdForDate(schoolId, dateStr);
    const cs = (classSection || '').trim();
    if (!cs) return null;
    const qb = this.repo
      .createQueryBuilder('t')
      .innerJoinAndSelect('t.user', 'u')
      .where('t.school_id = :schoolId', { schoolId })
      .andWhere('t.day_of_week = :dayOfWeek', { dayOfWeek })
      .andWhere('t.lesson_num = :lessonNum', { lessonNum })
      .andWhere('LOWER(TRIM(t.class_section)) = LOWER(:cs)', { cs });
    if (planId) qb.andWhere('t.plan_id = :planId', { planId });
    else qb.andWhere('t.plan_id IS NULL');
    const row = await qb.getOne();
    if (!row) return null;
    const teacher_name = row.user?.display_name?.trim() || row.user?.email || '—';
    return {
      user_id: String(row.user_id),
      subject: row.subject ?? '',
      teacher_name,
    };
  }

  /**
   * Sınıf için haftalık tüm slotlar (Akıllı Tahta: program otomatik doldurma).
   * Geçerli plana göre day_of_week 1-5, lesson_num 1..maxLessons.
   */
  async getSlotsByClassSectionForWeek(
    schoolId: string,
    classSection: string,
  ): Promise<{ day_of_week: number; lesson_num: number; user_id: string; subject: string; teacher_name: string }[]> {
    const cs = (classSection || '').trim();
    if (!cs) return [];
    const today = new Date().toISOString().slice(0, 10);
    const planId = await this.getActivePlanIdForDate(schoolId, today);
    const maxLessons = await this.getMaxLessons(schoolId);
    const qb = this.repo
      .createQueryBuilder('t')
      .innerJoinAndSelect('t.user', 'u')
      .where('t.school_id = :schoolId', { schoolId })
      .andWhere('t.day_of_week BETWEEN 1 AND 5')
      .andWhere('t.lesson_num BETWEEN 1 AND :max', { max: maxLessons })
      .andWhere('LOWER(TRIM(t.class_section)) = LOWER(:cs)', { cs });
    if (planId) qb.andWhere('t.plan_id = :planId', { planId });
    else qb.andWhere('t.plan_id IS NULL');
    const rows = await qb.orderBy('t.day_of_week').addOrderBy('t.lesson_num').getMany();
    return rows.map((r) => ({
      day_of_week: r.day_of_week,
      lesson_num: r.lesson_num,
      user_id: String(r.user_id),
      subject: r.subject ?? '',
      teacher_name: r.user?.display_name?.trim() || r.user?.email || '—',
    }));
  }

  /** Öğretmenin ders verdiği sınıflar (Akıllı Tahta restrict için). */
  async getClassSectionsForTeacher(schoolId: string | null, userId: string): Promise<string[]> {
    if (!schoolId) return [];
    const today = new Date().toISOString().slice(0, 10);
    const planId = await this.getActivePlanIdForDate(schoolId, today);
    const qb = this.repo
      .createQueryBuilder('t')
      .select('DISTINCT TRIM(t.class_section)', 'class_section')
      .where('t.school_id = :schoolId', { schoolId })
      .andWhere('t.user_id = :userId', { userId })
      .andWhere('t.class_section IS NOT NULL')
      .andWhere("TRIM(t.class_section) != ''");
    if (planId) qb.andWhere('t.plan_id = :planId', { planId });
    else qb.andWhere('t.plan_id IS NULL');
    const rows = await qb.getRawMany<{ class_section: string }>();
    return rows.map((r) => (r.class_section?.trim() ?? '').toUpperCase()).filter(Boolean);
  }

  /** Ders programındaki tekil sınıf listesi (Akıllı Tahta ayarlar için). */
  async getDistinctClassSections(schoolId: string | null): Promise<string[]> {
    if (!schoolId) return [];
    const today = new Date().toISOString().slice(0, 10);
    const planId = await this.getActivePlanIdForDate(schoolId, today);
    const qb = this.repo
      .createQueryBuilder('t')
      .select('DISTINCT TRIM(t.class_section)', 'class_section')
      .where('t.school_id = :schoolId', { schoolId })
      .andWhere('t.class_section IS NOT NULL')
      .andWhere("TRIM(t.class_section) != ''");
    if (planId) qb.andWhere('t.plan_id = :planId', { planId });
    else qb.andWhere('t.plan_id IS NULL');
    const rows = await qb.getRawMany<{ class_section: string }>();
    return rows.map((r) => r.class_section?.trim() ?? '').filter(Boolean).sort();
  }

  /** Okuldaki maksimum ders saati (6–12). Veri yoksa 8. Bugün geçerli plana göre. */
  async getMaxLessons(schoolId: string | null): Promise<number> {
    if (!schoolId) return 8;
    const today = new Date().toISOString().slice(0, 10);
    const planId = await this.getActivePlanIdForDate(schoolId, today);
    const qb = this.repo
      .createQueryBuilder('t')
      .select('MAX(t.lesson_num)', 'max')
      .where('t.school_id = :schoolId', { schoolId });
    if (planId) qb.andWhere('t.plan_id = :planId', { planId });
    else qb.andWhere('t.plan_id IS NULL');
    const result = await qb.getRawOne<{ max: number | null }>();
    const n = result?.max != null ? Number(result.max) : 0;
    return n >= 6 && n <= 12 ? n : n > 0 ? Math.min(12, Math.max(6, n)) : 8;
  }

  /** Öğretmenin tarih aralığındaki günlük ders sayıları (ajanda takvimi için) */
  async getTeacherLessonSummaryForDateRange(
    schoolId: string | null,
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<Array<{ date: string; lessonCount: number }>> {
    if (!schoolId) return [];
    const start = new Date(startDate.slice(0, 10));
    const end = new Date(endDate.slice(0, 10));
    const result: Array<{ date: string; lessonCount: number }> = [];
    const current = new Date(start);
    while (current <= end) {
      const dateStr = current.toISOString().slice(0, 10);
      const dayOfWeek = this.getDayOfWeekFromDate(dateStr);
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        try {
          const byDate = await this.getByDate(schoolId, dateStr);
          const lessons = byDate[userId] ?? {};
          const count = Object.keys(lessons).length;
          if (count > 0) result.push({ date: dateStr, lessonCount: count });
        } catch {
          // skip
        }
      }
      current.setDate(current.getDate() + 1);
    }
    return result;
  }

  /** Öğretmenin o gün boş olduğu ders saatleri. maxLessons kullanır (varsayılan 8). */
  async getFreeLessonsForDate(
    schoolId: string | null,
    userId: string,
    date: string,
    maxLessons = 8,
  ): Promise<number[]> {
    const byDate = await this.getByDate(schoolId, date);
    const busy = byDate[userId] ?? {};
    const free: number[] = [];
    const cap = Math.min(12, Math.max(6, maxLessons));
    for (let i = 1; i <= cap; i++) {
      if (!busy[i]) free.push(i);
    }
    return free;
  }

  /**
   * Okuldaki öğretmenler için her gün (1=Pzt…5=Cum) ders sayısını döndürür.
   * Dönen yapı: userId → dayOfWeek(1-5) → lessonCount
   * MEB Madde 91/a: Nöbet, ders sayısının en az olduğu güne tercih edilir.
   * Bugün geçerli plana göre hesaplanır.
   */
  async getLessonCountByDayForUsers(
    schoolId: string | null,
    userIds: string[],
  ): Promise<Map<string, Map<number, number>>> {
    const result = new Map<string, Map<number, number>>();
    if (!schoolId || userIds.length === 0) return result;

    const today = new Date().toISOString().slice(0, 10);
    const planId = await this.getActivePlanIdForDate(schoolId, today);
    const qb = this.repo
      .createQueryBuilder('t')
      .select(['t.user_id', 't.day_of_week'])
      .addSelect('COUNT(*)::int', 'cnt')
      .where('t.school_id = :schoolId', { schoolId })
      .andWhere('t.user_id IN (:...userIds)', { userIds });
    if (planId) qb.andWhere('t.plan_id = :planId', { planId });
    else qb.andWhere('t.plan_id IS NULL');
    const rows = await qb
      .groupBy('t.user_id, t.day_of_week')
      .getRawMany<{ t_user_id: string; t_day_of_week: number; cnt: number }>();

    for (const row of rows) {
      const uid = row.t_user_id;
      if (!result.has(uid)) result.set(uid, new Map());
      result.get(uid)!.set(row.t_day_of_week, Number(row.cnt));
    }
    return result;
  }

  /** Yerine görevlendirme önerisi: o gün nöbetçi olan öğretmenlerden, verilen lesson_num'da boş olanlar (çoğu boş saat önce). Nöbetçi yoksa tüm öğretmenler. */
  async suggestReplacement(
    schoolId: string | null,
    date: string,
    dutyUserIds: string[],
    lessonNum?: number,
    excludeUserId?: string,
  ): Promise<{ user_id: string; display_name: string | null; email: string; free_lesson_count: number; has_target_free: boolean }[]> {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    const [byDate, maxLessons] = await Promise.all([this.getByDate(schoolId, date), this.getMaxLessons(schoolId)]);
    const cap = Math.min(12, Math.max(6, maxLessons));

    const idsToFetch = dutyUserIds.length > 0 ? dutyUserIds : [];
    const users = await this.userRepo
      .createQueryBuilder('u')
      .select(['u.id', 'u.display_name', 'u.email'])
      .where('u.school_id = :schoolId', { schoolId })
      .andWhere('u.status = :status', { status: 'active' })
      .andWhere('u.role IN (:...roles)', { roles: ['teacher', 'school_admin'] })
      .andWhere('(u.duty_exempt IS NULL OR u.duty_exempt = false)')
      .orderBy('u.display_name', 'ASC')
      .getMany();

    const filteredUsers = idsToFetch.length > 0 ? users.filter((u) => idsToFetch.includes(u.id)) : users;

    if (filteredUsers.length === 0) {
      return [];
    }

    const result = filteredUsers
      .filter((u) => u.id !== excludeUserId)
      .map((u) => {
        const busy = byDate[u.id] ?? {};
        let freeCount = 0;
        for (let i = 1; i <= cap; i++) {
          if (!busy[i]) freeCount++;
        }
        const hasTargetFree = lessonNum != null ? !busy[lessonNum] : true;
        return {
          user_id: u.id,
          display_name: u.display_name,
          email: u.email,
          free_lesson_count: freeCount,
          has_target_free: hasTargetFree,
        };
      })
      .filter((r) => r.has_target_free)
      .sort((a, b) => {
        if (lessonNum != null) return b.free_lesson_count - a.free_lesson_count;
        return b.free_lesson_count - a.free_lesson_count;
      });

    return result;
  }

  /** Türkçe karaktersiz normalize (eşleştirme için) */
  private normalizeForMatch(s: string): string {
    return s
      .toLowerCase()
      .replace(/ı/g, 'i')
      .replace(/ş/g, 's')
      .replace(/ç/g, 'c')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ö/g, 'o')
      .trim();
  }

  /** Okul öğretmenlerini email veya display_name ile eşleştir */
  private async matchTeacher(schoolId: string, raw: string): Promise<string | null> {
    const trim = String(raw ?? '').trim();
    if (!trim) return null;
    const normalized = this.normalizeForMatch(trim);
    const users = await this.userRepo
      .createQueryBuilder('u')
      .select(['u.id', 'u.email', 'u.display_name'])
      .where('u.school_id = :schoolId', { schoolId })
      .andWhere('u.role IN (:...roles)', { roles: ['teacher', 'school_admin'] })
      .getMany();

    for (const u of users) {
      const email = (u.email ?? '').toLowerCase();
      const name = this.normalizeForMatch(u.display_name ?? '');
      const nTrim = normalized;
      if (email === trim || email === nTrim || name === nTrim) return u.id;
      if (name.includes(nTrim) || nTrim.includes(name)) return u.id;
      if (email.startsWith(nTrim) || nTrim.startsWith(email)) return u.id;
    }
    return null;
  }

  private parseDay(val: unknown): number | null {
    const s = String(val ?? '').trim();
    if (!s) return null;
    const lower = s.toLowerCase();
    if (DAY_ALIASES[lower] != null) return DAY_ALIASES[lower];
    const n = parseInt(s, 10);
    if (n >= 1 && n <= 5) return n;
    return null;
  }

  /** Ders saati: 1–12 (opsiyonel, okula göre 6–12 arası) */
  private parseLessonNum(val: unknown): number | null {
    const n = parseInt(String(val ?? ''), 10);
    if (n >= 1 && n <= 12) return n;
    return null;
  }

  /** Hücre değerinden "7A-MAT" veya "7A - Matematik" → { class_section, subject } */
  private parseCellToClassSubject(val: unknown): { class_section: string; subject: string } | null {
    const s = String(val ?? '').trim();
    if (!s) return null;
    if (s.includes(' - ')) {
      const [a, b] = s.split(' - ').map((x) => x.trim());
      if (a && b) return { class_section: a, subject: b };
    }
    if (s.includes('-')) {
      const idx = s.indexOf('-');
      const a = s.slice(0, idx).trim();
      const b = s.slice(idx + 1).trim();
      if (a && b) return { class_section: a, subject: b };
    }
    return null;
  }

  /**
   * Geniş format sütun adını parse et.
   * Desteklenen formatlar:
   *   Pazartesi_ders3  Pazartesi_3  Pzt-3  Pzt 3  Pazartesi 3
   *   Sali_ders2  Sali_2  Sal-2  Sal 2  Salı_ders2
   *   Carsamba_ders1  Çarşamba_ders1  Car-1
   *   Persembe_ders4  Perşembe_ders4  Per-4
   *   Cuma_ders5  Cum-5
   */
  private parseWideColumnName(h: string): { day: number; lesson: number } | null {
    const norm = h.toLowerCase()
      .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ç/g, 'c')
      .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o')
      .trim();

    // Day prefixes (full + short)
    const dayPatterns: [string[], number][] = [
      [['pazartesi', 'pzt', 'pz'], 1],
      [['sali', 'sal'], 2],
      [['carsamba', 'car', 'ca'], 3],
      [['persembe', 'per', 'pr'], 4],
      [['cuma', 'cum', 'cu'], 5],
    ];

    for (const [prefixes, day] of dayPatterns) {
      for (const prefix of prefixes) {
        if (!norm.startsWith(prefix)) continue;
        const rest = norm.slice(prefix.length).replace(/^[_\-\s]+/, '').replace(/^ders/i, '').replace(/^[_\-\s]+/, '');
        const lessonNum = parseInt(rest, 10);
        if (!isNaN(lessonNum) && lessonNum >= 1 && lessonNum <= 12) {
          return { day, lesson: lessonNum };
        }
      }
    }
    return null;
  }

  async uploadFromExcel(schoolId: string | null, filePath: string): Promise<UploadResult> {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });

    const maxLessons = await this.getSchoolConfigMaxLessons(schoolId);
    const wb = XLSX.readFile(filePath, { cellDates: false });
    // 'DersProgram' sayfasını önce ara; yoksa Kılavuz dışındaki ilk sayfayı al
    const sheetName =
      wb.SheetNames.find((s) => /ders.?program/i.test(s)) ??
      wb.SheetNames.find((s) => !/k[iı]lavuz/i.test(s)) ??
      wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    if (!sheet) throw new BadRequestException({ code: 'INVALID_FILE', message: 'Excel dosyası boş.' });

    const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];
    if (json.length < 2) throw new BadRequestException({ code: 'INVALID_FILE', message: 'En az başlık ve bir veri satırı gerekli.' });

    // '#' ile başlayan yorum satırlarını atla, gerçek başlık satırını bul
    let headerRowIdx = 0;
    for (let i = 0; i < json.length; i++) {
      const firstCell = String((json[i] as unknown[])[0] ?? '').trim();
      if (!firstCell.startsWith('#') && firstCell !== '') {
        headerRowIdx = i;
        break;
      }
    }

    const headerRow = (json[headerRowIdx] as unknown[]).map((c) => String(c ?? '').trim());
    const headerLower = headerRow.map((c) => c.toLowerCase());

    const wideCols: { colIndex: number; day: number; lesson: number }[] = [];
    let teacherCol = -1;
    for (let i = 0; i < headerRow.length; i++) {
      const h = headerRow[i];
      const parsed = this.parseWideColumnName(h);
      if (parsed) wideCols.push({ colIndex: i, day: parsed.day, lesson: parsed.lesson });
      if (/ad_soyad|ad soyad|adsoyad|öğretmen|ogretmen|teacher|isim|^ad$/.test(headerLower[i])) teacherCol = i;
    }

    const errors: string[] = [];
    const toInsert: TimetableEntry[] = [];

    if (wideCols.length > 0 && teacherCol >= 0) {
      for (let rowIdx = headerRowIdx + 1; rowIdx < json.length; rowIdx++) {
        const row = json[rowIdx] as unknown[];
        const teacherRaw = row[teacherCol];
        const teacherStr = String(teacherRaw ?? '').trim();
        if (!teacherStr) continue;

        const userId = await this.matchTeacher(schoolId, teacherStr);
        if (!userId) {
          errors.push(`Satır ${rowIdx + 1}: Öğretmen eşleşmedi (${teacherStr})`);
          continue;
        }

        for (const { colIndex, day, lesson } of wideCols) {
          const cellVal = row[colIndex];
          const parsed = this.parseCellToClassSubject(cellVal);
          if (parsed) {
            toInsert.push({
              day_of_week: day,
              lesson_num: lesson,
              user_id: userId,
              class_section: parsed.class_section,
              subject: parsed.subject,
            });
          }
        }
      }
    } else {
      const colMap: Record<string, number> = {};
      const aliases: [string[], string][] = [
        [['gün', 'gun', 'day'], 'day'],
        [['saat', 'ders', 'lesson', 'ders no', 'dersno'], 'lesson'],
        [['öğretmen', 'ogretmen', 'teacher', 'email', 'ad', 'isim'], 'teacher'],
        [['sınıf', 'sinif', 'class', 'sube'], 'class'],
        [['ders adı', 'ders adi', 'dersadı', 'dersadi', 'subject', 'branş', 'brans'], 'subject'],
      ];
      for (let i = 0; i < headerLower.length; i++) {
        const h = headerLower[i];
        for (const [keys, field] of aliases) {
          if (keys.some((k) => h.includes(k))) colMap[field] = i;
        }
      }

      if (!colMap.teacher || !colMap.class || !colMap.subject) {
        throw new BadRequestException({
          code: 'INVALID_FORMAT',
          message: 'Excel\'de Öğretmen (veya Ad_Soyad), Sınıf ve Ders sütunları veya wide format (Pazartesi_ders1 vb.) bulunmalı.',
        });
      }

      for (let rowIdx = headerRowIdx + 1; rowIdx < json.length; rowIdx++) {
        const row = json[rowIdx] as unknown[];
        const teacherRaw = row[colMap.teacher];
        const classSection = String(row[colMap.class] ?? '').trim();
        const subject = String(row[colMap.subject] ?? '').trim();
        if (!classSection || !subject) continue;

        const day = colMap.day != null ? this.parseDay(row[colMap.day]) : 1;
        const lesson = colMap.lesson != null ? this.parseLessonNum(row[colMap.lesson]) : 1;
        if (day == null || lesson == null) {
          errors.push(`Satır ${rowIdx + 1}: Geçersiz gün/saat`);
          continue;
        }

        const userId = await this.matchTeacher(schoolId, String(teacherRaw ?? ''));
        if (!userId) {
          errors.push(`Satır ${rowIdx + 1}: Öğretmen eşleşmedi (${teacherRaw})`);
          continue;
        }
        toInsert.push({ day_of_week: day, lesson_num: lesson, user_id: userId, class_section: classSection, subject });
      }
    }

    // Okul max ders saati dışındaki kayıtları atla (farklı ayarlı okullardan karışmayı önler)
    const overMax = toInsert.filter((e) => e.lesson_num > maxLessons);
    const valid = toInsert.filter((e) => e.lesson_num <= maxLessons);
    toInsert.length = 0;
    toInsert.push(...valid);
    if (overMax.length > 0) {
      const hours = [...new Set(overMax.map((x) => x.lesson_num))].sort((a, b) => a - b);
      errors.push(
        `Okul ayarlarına göre en fazla ${maxLessons} ders saati. ${overMax.length} kayıt atlandı (ders saatleri: ${hours.join(', ')}).`,
      );
    }

    if (toInsert.length === 0) {
      throw new BadRequestException({
        code: 'NO_VALID_ROWS',
        message: errors.length ? errors.slice(0, 5).join('; ') : 'Geçerli satır bulunamadı. Öğretmen adı/email sistemdeki ile eşleşmeli.',
      });
    }

    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10);
    const year = today.getFullYear();
    const nextYear = year + 1;
    const academicYear = `${year}-${String(nextYear).slice(-2)}`;

    const plan = this.planRepo.create({
      school_id: schoolId,
      name: `Taslak ${dateStr}`,
      valid_from: dateStr,
      valid_until: `${year + 1}-06-30`,
      status: 'draft',
      academic_year: academicYear,
      published_at: null,
      created_by: null,
    });
    await this.planRepo.save(plan);

    const entries = toInsert.map((e) =>
      this.planEntryRepo.create({
        plan_id: plan.id,
        user_id: e.user_id,
        day_of_week: e.day_of_week,
        lesson_num: e.lesson_num,
        class_section: e.class_section,
        subject: e.subject,
      }),
    );
    await this.planEntryRepo.save(entries);

    return { imported: entries.length, errors, plan_id: plan.id };
  }

  /** Taslak plan listesi (school_admin); son taslaklar önce. */
  async listPlans(schoolId: string | null): Promise<TimetablePlanDto[]> {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    const plans = await this.planRepo.find({
      where: { school_id: schoolId },
      relations: ['entries'],
      order: { created_at: 'DESC' },
    });
    return plans.map((p) => ({
      id: p.id,
      name: p.name,
      valid_from: p.valid_from,
      valid_until: p.valid_until,
      status: p.status,
      published_at: p.published_at?.toISOString() ?? null,
      academic_year: p.academic_year,
      created_at: p.created_at.toISOString(),
      entry_count: p.entries?.length ?? 0,
    }));
  }

  /** Plan detayı + entries (flat TimetableEntry listesi). */
  async getPlanById(planId: string, schoolId: string | null): Promise<{
    id: string;
    name: string | null;
    valid_from: string;
    valid_until: string | null;
    status: string;
    published_at: string | null;
    academic_year: string | null;
    entries: TimetableEntry[];
  }> {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    const plan = await this.planRepo.findOne({
      where: { id: planId, school_id: schoolId },
      relations: ['entries'],
    });
    if (!plan) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Plan bulunamadı.' });
    const entries: TimetableEntry[] = (plan.entries ?? []).map((e) => ({
      day_of_week: e.day_of_week,
      lesson_num: e.lesson_num,
      user_id: e.user_id,
      class_section: e.class_section,
      subject: e.subject,
    }));
    return {
      id: plan.id,
      name: plan.name,
      valid_from: plan.valid_from,
      valid_until: plan.valid_until,
      status: plan.status,
      published_at: plan.published_at?.toISOString() ?? null,
      academic_year: plan.academic_year,
      entries,
    };
  }

  /** Taslak planı yayınlar: overlap kontrolü, teacher_timetable güncellemesi, bildirim. valid_until null = açık uçlu. */
  async publishPlan(
    planId: string,
    schoolId: string | null,
    userId: string,
    validFrom: string,
    validUntil: string | null,
  ): Promise<{ success: boolean; plan_id: string }> {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });

    const plan = await this.planRepo.findOne({
      where: { id: planId, school_id: schoolId },
      relations: ['entries'],
    });
    if (!plan) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Plan bulunamadı.' });
    if (plan.status !== 'draft') {
      throw new BadRequestException({ code: 'ALREADY_PUBLISHED', message: 'Bu plan zaten yayınlanmış.' });
    }

    const vFrom = validFrom.slice(0, 10);
    const vUntil = validUntil ? validUntil.slice(0, 10) : null;
    if (vUntil && vFrom > vUntil) {
      throw new BadRequestException({ code: 'INVALID_DATES', message: 'Bitiş tarihi başlangıçtan önce olamaz.' });
    }

    const vUntilMax = vUntil ?? '9999-12-31';
    const conflict = await this.planRepo
      .createQueryBuilder('p')
      .where('p.school_id = :schoolId', { schoolId })
      .andWhere('p.status = :status', { status: 'published' })
      .andWhere('p.id != :planId', { planId })
      .andWhere('(p.valid_until IS NULL OR p.valid_until >= :vFrom)', { vFrom })
      .andWhere('p.valid_from <= :vUntilMax', { vUntilMax })
      .getOne();

    if (conflict) {
      const untilStr = conflict.valid_until ?? 'açık uçlu';
      throw new BadRequestException({
        code: 'TIMETABLE_PLAN_OVERLAP',
        message: `Bu tarih aralığı başka bir programla çakışıyor: ${conflict.name ?? '(adsız)'} (${conflict.valid_from} – ${untilStr}). Bitiş tarihini düzenleyin veya mevcut programı sonlandırın.`,
      });
    }

    const prevOpenEnded = await this.planRepo
      .createQueryBuilder('p')
      .where('p.school_id = :schoolId', { schoolId })
      .andWhere('p.status = :status', { status: 'published' })
      .andWhere('p.valid_until IS NULL')
      .andWhere('p.valid_from < :vFrom', { vFrom })
      .andWhere('p.id != :planId', { planId })
      .getMany();
    const dayBefore = new Date(vFrom + 'T12:00:00');
    dayBefore.setDate(dayBefore.getDate() - 1);
    const newUntil = dayBefore.toISOString().slice(0, 10);
    for (const prev of prevOpenEnded) {
      prev.valid_until = newUntil;
      await this.planRepo.save(prev);
    }

    const entries = plan.entries ?? [];
    const ttEntities = entries.map((e) =>
      this.repo.create({
        school_id: schoolId,
        plan_id: planId,
        user_id: e.user_id,
        day_of_week: e.day_of_week,
        lesson_num: e.lesson_num,
        class_section: e.class_section,
        subject: e.subject,
      }),
    );
    await this.repo.save(ttEntities);

    plan.valid_from = vFrom;
    plan.valid_until = vUntil;
    plan.status = 'published';
    plan.published_at = new Date();
    plan.created_by = userId;
    await this.planRepo.save(plan);

    const teacherIds = await this.userRepo
      .createQueryBuilder('u')
      .select('u.id')
      .where('u.school_id = :schoolId', { schoolId })
      .andWhere('u.role IN (:...roles)', { roles: ['teacher', 'school_admin'] })
      .getMany()
      .then((rows) => rows.map((r) => r.id));

    const periodStr = vUntil ? `${vFrom} – ${vUntil}` : `${vFrom} – (açık uçlu)`;
    for (const tid of teacherIds) {
      const isPublisher = tid === userId;
      const title = isPublisher ? 'Ders programı yayınlandı' : 'Ders programı güncellendi';
      const body = isPublisher
        ? `Yayınladığınız program (${periodStr}) öğretmenlere iletildi. Programlarım sayfasından görüntüleyebilirsiniz.`
        : `Okul ders programınız yayınlandı (${periodStr}). Programınızı görüntüleyin.`;
      await this.notificationsService.createInboxEntry({
        user_id: tid,
        event_type: 'timetable.published',
        entity_id: planId,
        target_screen: 'ders-programi',
        title,
        body,
      });
    }

    return { success: true, plan_id: planId };
  }

  /** Yayınlanmış planın geçerlilik tarihlerini günceller. valid_until null = açık uçlu. */
  async updatePlanDates(
    planId: string,
    schoolId: string | null,
    validFrom: string,
    validUntil: string | null,
  ): Promise<{ success: boolean }> {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });

    const plan = await this.planRepo.findOne({ where: { id: planId, school_id: schoolId } });
    if (!plan) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Plan bulunamadı.' });
    if (plan.status !== 'published') {
      throw new BadRequestException({ code: 'NOT_PUBLISHED', message: 'Sadece yayınlanmış planların tarihleri güncellenebilir.' });
    }

    const vFrom = validFrom.slice(0, 10);
    const vUntil = validUntil ? validUntil.slice(0, 10) : null;
    if (vUntil && vFrom > vUntil) {
      throw new BadRequestException({ code: 'INVALID_DATES', message: 'Bitiş tarihi başlangıçtan önce olamaz.' });
    }

    const vUntilMax = vUntil ?? '9999-12-31';
    const conflict = await this.planRepo
      .createQueryBuilder('p')
      .where('p.school_id = :schoolId', { schoolId })
      .andWhere('p.status = :status', { status: 'published' })
      .andWhere('p.id != :planId', { planId })
      .andWhere('(p.valid_until IS NULL OR p.valid_until >= :vFrom)', { vFrom })
      .andWhere('p.valid_from <= :vUntilMax', { vUntilMax })
      .getOne();

    if (conflict) {
      const untilStr = conflict.valid_until ?? 'açık uçlu';
      throw new BadRequestException({
        code: 'TIMETABLE_PLAN_OVERLAP',
        message: `Bu tarih aralığı başka bir programla çakışıyor: ${conflict.name ?? '(adsız)'} (${conflict.valid_from} – ${untilStr}).`,
      });
    }

    plan.valid_from = vFrom;
    plan.valid_until = vUntil;
    await this.planRepo.save(plan);

    return { success: true };
  }

  async clear(schoolId: string | null): Promise<{ success: boolean }> {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    await this.repo.delete({ school_id: schoolId });
    await this.planRepo.delete({ school_id: schoolId });
    return { success: true };
  }

  // ── Öğretmen kişisel program CRUD ─────────────────────────────────────────

  async listPersonalPrograms(schoolId: string | null, userId: string): Promise<PersonalProgramDto[]> {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    const programs = await this.personalProgramRepo.find({
      where: { school_id: schoolId, user_id: userId },
      order: { updated_at: 'DESC' },
      relations: ['entries'],
    });
    return programs.map((p) => ({
      id: p.id,
      name: p.name,
      academic_year: p.academic_year,
      term: p.term,
      total_hours: p.entries?.length ?? 0,
      created_at: p.created_at.toISOString(),
      updated_at: p.updated_at.toISOString(),
    }));
  }

  async getPersonalProgramById(
    programId: string,
    schoolId: string | null,
    userId: string,
  ): Promise<PersonalProgramWithEntriesDto> {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    const program = await this.personalProgramRepo.findOne({
      where: { id: programId, school_id: schoolId, user_id: userId },
      relations: ['entries'],
    });
    if (!program) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Program bulunamadı.' });
    const entries = (program.entries ?? []).map((e) => ({
      day_of_week: e.day_of_week,
      lesson_num: e.lesson_num,
      user_id: userId,
      class_section: e.class_section,
      subject: e.subject,
    }));
    return {
      id: program.id,
      name: program.name,
      academic_year: program.academic_year,
      term: program.term,
      total_hours: entries.length,
      created_at: program.created_at.toISOString(),
      updated_at: program.updated_at.toISOString(),
      entries,
    };
  }

  async createPersonalProgram(
    schoolId: string | null,
    userId: string,
    body: { name: string; academic_year?: string; term?: string; entries?: Omit<TimetableEntry, 'user_id'>[] },
  ): Promise<PersonalProgramWithEntriesDto> {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    const name = String(body.name ?? '').trim();
    if (!name) throw new BadRequestException({ code: 'NAME_REQUIRED', message: 'Program adı gerekli.' });
    const academicYear = String(body.academic_year ?? '').trim() || new Date().getFullYear().toString();
    const term = String(body.term ?? 'Tüm Yıl').trim();

    const program = this.personalProgramRepo.create({
      school_id: schoolId,
      user_id: userId,
      name,
      academic_year: academicYear,
      term,
    });
    await this.personalProgramRepo.save(program);

    const entries = Array.isArray(body.entries) ? body.entries : [];
    if (entries.length > 0) {
      const entryEntities = entries
        .filter((e) => e.day_of_week >= 1 && e.day_of_week <= 5 && e.lesson_num >= 1 && e.lesson_num <= 12)
        .map((e) =>
          this.personalEntryRepo.create({
            program_id: program.id,
            day_of_week: e.day_of_week,
            lesson_num: e.lesson_num,
            class_section: String(e.class_section ?? '').slice(0, 32),
            subject: String(e.subject ?? '').slice(0, 128),
          }),
        );
      await this.personalEntryRepo.save(entryEntities);
    }

    return this.getPersonalProgramById(program.id, schoolId, userId);
  }

  async updatePersonalProgram(
    programId: string,
    schoolId: string | null,
    userId: string,
    body: { name?: string; academic_year?: string; term?: string; entries?: Omit<TimetableEntry, 'user_id'>[] },
  ): Promise<PersonalProgramWithEntriesDto> {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    const program = await this.personalProgramRepo.findOne({
      where: { id: programId, school_id: schoolId, user_id: userId },
    });
    if (!program) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Program bulunamadı.' });

    if (body.name != null) program.name = String(body.name).trim();
    if (body.academic_year != null) program.academic_year = String(body.academic_year).trim();
    if (body.term != null) program.term = String(body.term).trim();
    await this.personalProgramRepo.save(program);

    if (Array.isArray(body.entries)) {
      await this.personalEntryRepo.delete({ program_id: programId });
      const valid = body.entries.filter((e) => e.day_of_week >= 1 && e.day_of_week <= 5 && e.lesson_num >= 1 && e.lesson_num <= 12);
      if (valid.length > 0) {
        const entryEntities = valid.map((e) =>
          this.personalEntryRepo.create({
            program_id: programId,
            day_of_week: e.day_of_week,
            lesson_num: e.lesson_num,
            class_section: String(e.class_section ?? '').slice(0, 32),
            subject: String(e.subject ?? '').slice(0, 128),
          }),
        );
        await this.personalEntryRepo.save(entryEntities);
      }
    }

    return this.getPersonalProgramById(programId, schoolId, userId);
  }

  async deletePersonalProgram(programId: string, schoolId: string | null, userId: string): Promise<{ success: boolean }> {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    const program = await this.personalProgramRepo.findOne({
      where: { id: programId, school_id: schoolId, user_id: userId },
    });
    if (!program) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Program bulunamadı.' });
    await this.personalProgramRepo.remove(program);
    return { success: true };
  }

  /** Öğretmenin idare programını (getByMe) kendi programlarına aktarır. Düzenlenebilir kopya oluşturur. */
  async importFromAdmin(schoolId: string | null, userId: string): Promise<PersonalProgramWithEntriesDto> {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    const entries = await this.getByMe(schoolId, userId);
    if (entries.length === 0) {
      throw new BadRequestException({
        code: 'NO_ENTRIES',
        message: 'Aktarılacak idare programı bulunamadı. Okul yöneticisi Excel yüklemesi yapmamış olabilir.',
      });
    }
    const year = new Date().getFullYear();
    const academicYear = `${year}-${year + 1}`;
    return this.createPersonalProgram(schoolId, userId, {
      name: 'İdare Programı (Aktarılan)',
      academic_year: academicYear,
      term: 'Tüm Yıl',
      entries: entries.map((e) => ({
        day_of_week: e.day_of_week,
        lesson_num: e.lesson_num,
        class_section: e.class_section,
        subject: e.subject,
      })),
    });
  }

  /**
   * Örnek Excel şablonu – wide format: Ad_Soyad + Gün_ders1..N sütunları.
   * MEB Madde 91/a: Nöbet, ders sayısının en az olduğu güne verilir.
   * Kılavuz sayfası + ders programı sayfasından oluşur; sütun genişlikleri ayarlanmıştır.
   */
  generateExampleExcel(maxLessons = 8): Buffer {
    const days = ['Pazartesi', 'Sali', 'Carsamba', 'Persembe', 'Cuma'];
    const dayDisplay = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma'];
    const n = Math.min(12, Math.max(6, maxLessons));

    // ── SAYFA 1: Kılavuz ────────────────────────────────────────────────────
    const guideRows: string[][] = [
      ['ÖĞRETMEN DERS PROGRAMI – YÜKLEME KILAVUZU'],
      [''],
      ['NEDEN YÜKLÜYORUZ?'],
      ['• MEB Madde 91/a: Nöbet dersi az olan güne verilir. Sistem bu tablodan otomatik hesaplar.'],
      ['• Yerine görevlendirmede: Gelemeyen öğretmen yerine, o saatte DERSI OLMAYAN nöbetçi görevlendirilir.'],
      [''],
      ['EXCEL FORMATINIZ NASIL OLMALI?'],
      ['• "DersProgram" sayfasını doldurun.'],
      ['• Ad_Soyad sütununa öğretmenin sistemdeki tam adını veya e-posta adresini yazın.'],
      [`• Her gün için ${n} ders sütunu var (1. ders … ${n}. ders).`],
      ['• Hücreye: SINIF-DERS şeklinde yazın. Örnekler: 7A-MAT   8B-TRK   9C-FEN'],
      ['• Boş hücre = o saatte dersi yok.'],
      [''],
      ['SINIF KODU ÖRNEKLERİ'],
      ['  7A, 8B, 9C, 10A, 11B, 12C …'],
      [''],
      ['DERS KISALTMASI ÖRNEKLERİ'],
      ['  MAT = Matematik        TRK = Türkçe        FEN = Fen Bilimleri'],
      ['  COĞ = Coğrafya         TAR = Tarih         BED = Beden Eğitimi'],
      ['  MÜZ = Müzik            BİL = Bilişim       İNG = İngilizce'],
      [''],
      ['ÖNEMLİ NOTLAR'],
      ['• Okul müdürü ve müdür yardımcıları tabloya eklenmemeli (nöbetten muaf).'],
      ['• Ad_Soyad sütunundaki isimler sistemdeki kullanıcı adı veya e-posta ile eşleşmeli.'],
      ['• Kaydetmeden önce DersProgram sayfasını kontrol edin.'],
    ];
    const wsGuide = XLSX.utils.aoa_to_sheet(guideRows);
    wsGuide['!cols'] = [{ wch: 90 }];

    // ── SAYFA 2: DersProgram ─────────────────────────────────────────────────
    // colCount: No + Ad_Soyad + 5 gün × n ders
    const colCount = 2 + days.length * n;
    const emptyRow = (): (string | number)[] => Array(colCount).fill('');
    const setCell = (row: (string | number)[], dayIdx: number, lesson: number, val: string) => {
      const colOffset = 2 + dayIdx * n + (lesson - 1);
      if (colOffset < colCount) row[colOffset] = val;
    };

    // Gün başlık satırları (görsel gruplama için)
    const dayGroupRow: string[] = ['', ''];
    for (let d = 0; d < days.length; d++) {
      dayGroupRow.push(dayDisplay[d] ?? '');
      for (let i = 1; i < n; i++) dayGroupRow.push('');
    }

    const headerRow: string[] = ['No', 'Ad Soyad'];
    for (let d = 0; d < days.length; d++) {
      for (let i = 1; i <= n; i++) headerRow.push(`${i}. Ders`);
    }

    const samples: { no: number; ad: string; fills: [number, number, string][] }[] = [
      { no: 1, ad: 'Ahmet Yılmaz', fills: [[0, 1, '7A-MAT'], [0, 2, '8B-MAT'], [1, 1, '9A-MAT'], [2, 4, '10B-COĞ'], [3, 2, '7B-MAT'], [4, 3, '8A-MAT']] },
      { no: 2, ad: 'Ayşe Demir', fills: [[0, 2, '7A-TRK'], [0, 4, '8A-TRK'], [1, 2, '6C-TRK'], [2, 1, '9A-TRK'], [4, 3, '8C-TRK'], [3, 5, '7D-TRK']] },
      { no: 3, ad: 'Mehmet Kaya', fills: [[0, 4, '9C-COĞ'], [1, 3, '10B-COĞ'], [2, 6, '11A-COĞ'], [3, 5, '9B-COĞ'], [4, 2, '10A-COĞ']] },
      { no: 4, ad: 'Fatma Öz', fills: [[0, 1, '8A-FEN'], [0, 6, '9B-FEN'], [1, 3, '7C-FEN'], [2, 2, '8B-FEN'], [4, 4, '7A-FEN'], [3, 1, '8C-FEN']] },
      { no: 5, ad: 'Ali Veli', fills: [[0, 5, '10A-MAT'], [2, 4, '6A-TRK'], [3, 1, '11B-MAT'], [4, 2, '10C-MAT'], [1, 4, '9B-MAT']] },
      { no: 6, ad: 'Zeynep Arslan', fills: [[0, 3, '7B-BED'], [1, 5, '8A-BED'], [2, 3, '9C-BED'], [3, 4, '10B-BED'], [4, 1, '11A-BED']] },
    ];

    // Sütun genişlikleri
    const colWidths = [
      { wch: 5 },   // No
      { wch: 22 },  // Ad Soyad
    ];
    for (let d = 0; d < days.length; d++) {
      for (let i = 0; i < n; i++) colWidths.push({ wch: 9 }); // örn: "7A-MAT"
    }

    // Satırlar: gün grup başlığı + sütun başlığı + veri
    const dataRows: (string | number)[][] = [dayGroupRow, headerRow];
    for (const s of samples) {
      const r = emptyRow();
      r[0] = s.no;
      r[1] = s.ad;
      for (const [dayIdx, lesson, val] of s.fills) setCell(r, dayIdx, lesson, val);
      dataRows.push(r);
    }
    // 3 boş örnek satır daha ekle
    for (let i = samples.length + 1; i <= samples.length + 3; i++) {
      const r = emptyRow();
      r[0] = i;
      dataRows.push(r);
    }

    // 1. satır: gün grupları (görsel gruplama)
    // 2. satır: parser'ın anlayacağı Pazartesi_ders1 formatı (parser bu satırı header olarak okur)
    const parserHeader: string[] = ['No', 'Ad_Soyad'];
    for (let d = 0; d < days.length; d++) {
      for (let i = 1; i <= n; i++) parserHeader.push(`${days[d]}_ders${i}`);
    }
    dataRows[1] = parserHeader;
    const ws2 = XLSX.utils.aoa_to_sheet(dataRows);
    ws2['!cols'] = colWidths;
    ws2['!freeze'] = { xSplit: 2, ySplit: 2 };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsGuide, 'Kılavuz');
    XLSX.utils.book_append_sheet(wb, ws2, 'DersProgram');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  /**
   * Duyuru TV: yayınlanmış okul ders programı + okul ders saatleri ile tv_timetable_schedule JSON üretir.
   */
  async buildTvTimetableScheduleJsonForTv(schoolId: string): Promise<string | null> {
    const school = await this.schoolRepo.findOne({
      where: { id: schoolId },
      select: ['lesson_schedule', 'lesson_schedule_pm', 'duty_education_mode'],
    });
    if (!school) return null;
    const rows = await this.getBySchool(schoolId);
    const toHHMM = (t: string) => {
      const s = String(t || '').trim();
      const m = s.match(/^(\d{1,2}):(\d{2})/);
      if (m) return `${String(Math.min(23, Math.max(0, parseInt(m[1], 10)))).padStart(2, '0')}:${m[2]}`;
      return s.slice(0, 5);
    };
    const am = Array.isArray(school.lesson_schedule) ? school.lesson_schedule : [];
    const pm = Array.isArray(school.lesson_schedule_pm) ? school.lesson_schedule_pm : [];
    const mode = school.duty_education_mode === 'double' ? 'double' : 'single';
    const byNum = new Map<number, { num: number; start: string; end: string }>();
    for (const slot of am) {
      if (slot && typeof slot.lesson_num === 'number' && slot.start_time && slot.end_time) {
        byNum.set(slot.lesson_num, {
          num: slot.lesson_num,
          start: toHHMM(slot.start_time),
          end: toHHMM(slot.end_time),
        });
      }
    }
    if (mode === 'double' && pm.length > 0) {
      for (const slot of pm) {
        if (slot && typeof slot.lesson_num === 'number' && slot.start_time && slot.end_time) {
          byNum.set(slot.lesson_num, {
            num: slot.lesson_num,
            start: toHHMM(slot.start_time),
            end: toHHMM(slot.end_time),
          });
        }
      }
    }
    let lesson_times = [...byNum.values()].sort((a, b) => a.num - b.num);
    if (lesson_times.length === 0) {
      lesson_times = [
        { num: 1, start: '08:30', end: '09:10' },
        { num: 2, start: '09:20', end: '10:00' },
      ];
    }
    const entryMap = new Map<string, { day: number; lesson: number; class: string; subject: string }>();
    for (const r of rows) {
      const day = r.day_of_week;
      if (day < 1 || day > 5) continue;
      const lesson = r.lesson_num;
      const cls = (r.class_section || '').trim();
      const subj = (r.subject || '').trim();
      if (!cls || !subj) continue;
      const k = `${day}|${lesson}|${cls}`;
      const ex = entryMap.get(k);
      if (ex) ex.subject = `${ex.subject} / ${subj}`;
      else entryMap.set(k, { day, lesson, class: cls, subject: subj });
    }
    const entries = Array.from(entryMap.values());
    if (entries.length === 0) return null;
    const class_sections = [...new Set(entries.map((e) => e.class))].sort((a, b) => a.localeCompare(b, 'tr'));
    return JSON.stringify({
      lesson_times,
      class_sections,
      entries,
    });
  }
}
