import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { UserRole } from '../types/enums';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { BilsemCalendarItem } from './entities/bilsem-calendar-item.entity';
import { BilsemCalendarAssignment } from './entities/bilsem-calendar-assignment.entity';
import { School } from '../schools/entities/school.entity';
import { User } from '../users/entities/user.entity';
import { WorkCalendarService } from '../work-calendar/work-calendar.service';
import { CreateBilsemCalendarItemDto } from './dto/create-calendar-item.dto';
import { UpdateBilsemCalendarItemDto } from './dto/update-calendar-item.dto';
import { PatchBilsemCalendarOverridesDto } from './dto/school-overrides.dto';
import { CreateBilsemCalendarAssignmentDto } from './dto/create-assignment.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { generateMebWorkCalendar } from '../config/meb-calendar';
import { BILSEM_CALENDAR_2025_2026 } from './bilsem-calendar.seed';

export interface BilsemAssignedUserView {
  userId: string;
  displayName: string | null;
  gorevTipi: 'sorumlu' | 'yardimci';
}

export interface BilsemItemView {
  id: string;
  title: string;
  path: string | null;
  iconKey: string | null;
  sortOrder: number;
  itemType: string;
  assignedUsers?: BilsemAssignedUserView[];
}

export interface BilsemWeekWithItems {
  id: string;
  academicYear: string;
  weekNumber: number;
  title: string | null;
  dateStart: string | null;
  dateEnd: string | null;
  sortOrder: number;
  items: BilsemItemView[];
}

@Injectable()
export class BilsemService {
  constructor(
    @InjectRepository(BilsemCalendarItem)
    private readonly calendarItemRepo: Repository<BilsemCalendarItem>,
    @InjectRepository(BilsemCalendarAssignment)
    private readonly assignmentRepo: Repository<BilsemCalendarAssignment>,
    @InjectRepository(School)
    private readonly schoolRepo: Repository<School>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly workCalendarService: WorkCalendarService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getWorkWeeksForPlan(academicYear: string) {
    const weeks = await this.workCalendarService.findAll(academicYear);
    return weeks.map((w) => ({
      id: w.id,
      weekOrder: w.weekOrder ?? 0,
      weekStart: w.weekStart,
      weekEnd: w.weekEnd,
    }));
  }

  private getAcademicYear(academicYear: string | undefined): string {
    const y = (academicYear ?? '').trim();
    if (y) return y;
    const year = new Date().getFullYear();
    const month = new Date().getMonth();
    return month < 8 ? `${year - 1}-${year}` : `${year}-${year + 1}`;
  }

  async getCalendarForViewer(academicYear: string, schoolId: string | null): Promise<BilsemWeekWithItems[]> {
    const workWeeks = await this.workCalendarService.findAll(this.getAcademicYear(academicYear));
    if (workWeeks.length === 0) return [];
    const weekIds = workWeeks.map((w) => w.id);
    const items = await this.calendarItemRepo.find({
      where: { weekId: In(weekIds) },
      order: { sortOrder: 'ASC' },
    });
    const overrides = schoolId ? await this.getSchoolOverrides(schoolId) : null;
    const hiddenIds = new Set(overrides?.hiddenItemIds ?? []);
    const customItems = overrides?.customItems ?? [];
    const assignableIds = items.map((i) => i.id);
    const assignments = schoolId && assignableIds.length > 0 ? await this.getAssignmentsByItem(schoolId, assignableIds) : new Map<string, BilsemAssignedUserView[]>();
    return this.buildWeeksWithItems(workWeeks, items, hiddenIds, customItems, assignments);
  }

  async getCalendarTemplate(academicYear: string): Promise<BilsemWeekWithItems[]> {
    const workWeeks = await this.workCalendarService.findAll(this.getAcademicYear(academicYear));
    if (workWeeks.length === 0) return [];
    const weekIds = workWeeks.map((w) => w.id);
    const items = await this.calendarItemRepo.find({
      where: { weekId: In(weekIds) },
      order: { sortOrder: 'ASC' },
    });
    return this.buildWeeksWithItems(workWeeks, items, new Set(), [], new Map());
  }

  private async getAssignmentsByItem(schoolId: string, itemIds: string[]): Promise<Map<string, BilsemAssignedUserView[]>> {
    if (itemIds.length === 0) return new Map();
    const gorevler = await this.assignmentRepo.find({
      where: { schoolId, bilsemCalendarItemId: In(itemIds) },
      relations: ['user'],
    });
    const map = new Map<string, BilsemAssignedUserView[]>();
    for (const g of gorevler) {
      const list = map.get(g.bilsemCalendarItemId) ?? [];
      list.push({ userId: g.userId, displayName: g.user?.display_name ?? null, gorevTipi: g.gorevTipi as 'sorumlu' | 'yardimci' });
      map.set(g.bilsemCalendarItemId, list);
    }
    return map;
  }

  private buildWeeksWithItems(
    workWeeks: Array<{ id: string; academicYear: string; weekStart: string; weekEnd: string; weekOrder?: number; haftaLabel?: string | null; tatilLabel?: string | null; isTatil?: boolean; sortOrder?: number | null }>,
    items: BilsemCalendarItem[],
    hiddenIds: Set<string>,
    customItems: PatchBilsemCalendarOverridesDto['customItems'],
    assignments: Map<string, BilsemAssignedUserView[]>,
  ): BilsemWeekWithItems[] {
    const itemsByWeek = new Map<string, BilsemCalendarItem[]>();
    for (const i of items) {
      const list = itemsByWeek.get(i.weekId) ?? [];
      list.push(i);
      itemsByWeek.set(i.weekId, list);
    }
    const customByWeek = new Map<string, NonNullable<typeof customItems>>();
    for (const c of customItems ?? []) {
      const list = customByWeek.get(c.weekId) ?? [];
      list.push(c);
      customByWeek.set(c.weekId, list);
    }
    return workWeeks.map((w, idx) => {
      const weekItems = itemsByWeek.get(w.id) ?? [];
      const viewItems: BilsemItemView[] = weekItems
        .filter((i) => i.isActive && !hiddenIds.has(i.id))
        .map((i) => ({
          id: i.id,
          title: i.title,
          path: i.path,
          iconKey: i.iconKey,
          sortOrder: i.sortOrder,
          itemType: i.itemType,
          assignedUsers: assignments.get(i.id) ?? [],
        }));
      for (const c of customByWeek.get(w.id) ?? []) {
        viewItems.push({
          id: c.id,
          title: c.title,
          path: c.path ?? null,
          iconKey: null,
          sortOrder: c.sortOrder,
          itemType: c.type,
        });
      }
      viewItems.sort((a, b) => a.sortOrder - b.sortOrder);
      const title = w.isTatil ? w.tatilLabel : w.haftaLabel;
      const weekNumber = w.weekOrder ?? idx + 1;
      return {
        id: w.id,
        academicYear: w.academicYear,
        weekNumber,
        title: title ?? null,
        dateStart: w.weekStart,
        dateEnd: w.weekEnd,
        sortOrder: w.sortOrder ?? idx + 1,
        items: viewItems,
      };
    });
  }

  async createCalendarItem(dto: CreateBilsemCalendarItemDto): Promise<BilsemCalendarItem> {
    await this.workCalendarService.findOne(dto.week_id);
    const item = this.calendarItemRepo.create({
      weekId: dto.week_id,
      itemType: dto.item_type,
      title: dto.title,
      path: dto.path ?? null,
      iconKey: dto.icon_key ?? null,
      sortOrder: dto.sort_order ?? 0,
      isActive: dto.is_active ?? true,
    });
    return this.calendarItemRepo.save(item);
  }

  async updateCalendarItem(id: string, dto: UpdateBilsemCalendarItemDto): Promise<BilsemCalendarItem> {
    const item = await this.calendarItemRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Öğe bulunamadı.' });
    if (dto.week_id !== undefined) {
      await this.workCalendarService.findOne(dto.week_id);
      item.weekId = dto.week_id;
    }
    if (dto.item_type !== undefined) item.itemType = dto.item_type;
    if (dto.title !== undefined) item.title = dto.title;
    if (dto.path !== undefined) item.path = dto.path;
    if (dto.icon_key !== undefined) item.iconKey = dto.icon_key;
    if (dto.sort_order !== undefined) item.sortOrder = dto.sort_order;
    if (dto.is_active !== undefined) item.isActive = dto.is_active;
    return this.calendarItemRepo.save(item);
  }

  async deleteCalendarItem(id: string): Promise<void> {
    const item = await this.calendarItemRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Öğe bulunamadı.' });
    item.isActive = false;
    await this.calendarItemRepo.save(item);
  }

  async reorderCalendarItems(itemIds: string[]): Promise<void> {
    for (let i = 0; i < itemIds.length; i++) {
      await this.calendarItemRepo.update(itemIds[i], { sortOrder: i });
    }
  }

  /** 2025-2026 BİLSEM şablonunu doldur (work_calendar haftaları ile eşleşir) */
  async seedBilsemCalendar(academicYear: string = '2025-2026'): Promise<{ seeded: number }> {
    const year = academicYear.trim();
    let workWeeks = await this.workCalendarService.findAll(year);
    if (workWeeks.length === 0) {
      const mebWeeks = generateMebWorkCalendar(year);
      workWeeks = await this.workCalendarService.bulkCreate(year, mebWeeks.map((w) => ({
        week_order: w.week_order,
        week_start: w.week_start,
        week_end: w.week_end,
        ay: w.ay,
        hafta_label: w.hafta_label,
        is_tatil: w.is_tatil,
        tatil_label: w.tatil_label,
        sinav_etiketleri: w.sinav_etiketleri,
      })));
    }
    const weekIds = workWeeks.map((w) => w.id);
    if (weekIds.length === 0) return { seeded: 0 };

    const seedData = year === '2025-2026' ? BILSEM_CALENDAR_2025_2026 : [];
    const seedByKey = new Map<string, (typeof seedData)[0]>();
    for (const row of seedData) {
      seedByKey.set(`${row.start}|${row.end}`, row);
    }

    const toDateKey = (d: string) => (typeof d === 'string' ? d.slice(0, 10) : '');
    let seeded = 0;
    const existingByWeek = await this.calendarItemRepo.find({ where: { weekId: In(weekIds) } });
    const byWeek = new Map<string, { type: string; title: string }[]>();
    for (const i of existingByWeek) {
      const list = byWeek.get(i.weekId) ?? [];
      list.push({ type: i.itemType, title: i.title });
      byWeek.set(i.weekId, list);
    }

    for (const wc of workWeeks) {
      const key = `${toDateKey(wc.weekStart)}|${toDateKey(wc.weekEnd)}`;
      const row = seedByKey.get(key);
      if (!row || row.items.length === 0) continue;

      const existing = byWeek.get(wc.id) ?? [];
      const existingSet = new Set(existing.map((e) => `${e.type}|${e.title}`));

      let so = (byWeek.get(wc.id) ?? []).length;
      for (const it of row.items) {
        const k = `${it.type}|${it.title}`;
        if (existingSet.has(k)) continue;
        const item = this.calendarItemRepo.create({
          weekId: wc.id,
          itemType: it.type,
          title: it.title,
          path: it.path ?? null,
          sortOrder: so,
          isActive: true,
        });
        await this.calendarItemRepo.save(item);
        existingSet.add(k);
        seeded++;
        so++;
      }
    }
    return { seeded };
  }

  async getSchoolOverrides(schoolId: string) {
    const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
    if (!school) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Okul bulunamadı.' });
    const ov = school.bilsem_calendar_overrides;
    return { hiddenItemIds: ov?.hiddenItemIds ?? [], customItems: ov?.customItems ?? [] };
  }

  async patchSchoolOverrides(schoolId: string, dto: PatchBilsemCalendarOverridesDto): Promise<void> {
    const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
    if (!school) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Okul bulunamadı.' });
    const current = school.bilsem_calendar_overrides ?? {};
    school.bilsem_calendar_overrides = {
      hiddenItemIds: dto.hiddenItemIds ?? current.hiddenItemIds ?? [],
      customItems: dto.customItems ?? current.customItems ?? [],
    };
    await this.schoolRepo.save(school);
  }

  async getMyAssignments(userId: string, schoolId: string | null, academicYear: string) {
    if (!schoolId) return [];
    const workWeeks = await this.workCalendarService.findAll(this.getAcademicYear(academicYear));
    if (workWeeks.length === 0) return [];
    const weekIds = workWeeks.map((w) => w.id);
    const items = await this.calendarItemRepo.find({
      where: { weekId: In(weekIds), isActive: true },
    });
    const itemIds = items.map((i) => i.id);
    if (itemIds.length === 0) return [];
    const gorevler = await this.assignmentRepo.find({
      where: { schoolId, userId, bilsemCalendarItemId: In(itemIds) },
      relations: ['bilsemCalendarItem', 'bilsemCalendarItem.workCalendar'],
    });
    return gorevler.map((g) => {
      const wc = g.bilsemCalendarItem?.workCalendar;
      return {
        id: g.id,
        itemId: g.bilsemCalendarItemId,
        itemTitle: g.bilsemCalendarItem?.title ?? '',
        weekId: g.bilsemCalendarItem?.weekId ?? '',
        weekDateStart: wc?.weekStart ?? null,
        weekDateEnd: wc?.weekEnd ?? null,
      weekLabel: (wc as { haftaLabel?: string; tatilLabel?: string })?.haftaLabel ?? (wc as { tatilLabel?: string })?.tatilLabel ?? null,
      gorevTipi: g.gorevTipi,
      sortOrder: (wc as { sortOrder?: number })?.sortOrder ?? 999,
      };
    }).sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
  }

  async getAssignments(schoolId: string, academicYear: string) {
    const workWeeks = await this.workCalendarService.findAll(this.getAcademicYear(academicYear));
    if (workWeeks.length === 0) return [];
    const weekIds = workWeeks.map((w) => w.id);
    const items = await this.calendarItemRepo.find({
      where: { weekId: In(weekIds), isActive: true },
    });
    const itemIds = items.map((i) => i.id);
    if (itemIds.length === 0) return [];
    const gorevler = await this.assignmentRepo.find({
      where: { schoolId, bilsemCalendarItemId: In(itemIds) },
      relations: ['user', 'bilsemCalendarItem', 'bilsemCalendarItem.workCalendar'],
    });
    return gorevler.map((g) => ({
      id: g.id,
      itemId: g.bilsemCalendarItemId,
      itemTitle: g.bilsemCalendarItem?.title ?? '',
      weekId: g.bilsemCalendarItem?.weekId ?? '',
      weekDateStart: g.bilsemCalendarItem?.workCalendar?.weekStart ?? null,
      weekDateEnd: g.bilsemCalendarItem?.workCalendar?.weekEnd ?? null,
      weekLabel: (g.bilsemCalendarItem?.workCalendar as { haftaLabel?: string; tatilLabel?: string } | undefined)?.haftaLabel ?? (g.bilsemCalendarItem?.workCalendar as { tatilLabel?: string } | undefined)?.tatilLabel ?? null,
      userId: g.userId,
      displayName: g.user?.display_name ?? null,
      gorevTipi: g.gorevTipi,
    })).sort((a, b) => (a.weekDateStart ?? '').localeCompare(b.weekDateStart ?? ''));
  }

  async createAssignment(schoolId: string, dto: CreateBilsemCalendarAssignmentDto, createdBy: string): Promise<BilsemCalendarAssignment> {
    const item = await this.calendarItemRepo.findOne({ where: { id: dto.bilsem_calendar_item_id } });
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Takvim öğesi bulunamadı.' });
    const user = await this.userRepo.findOne({ where: { id: dto.user_id }, relations: ['school'] });
    if (!user || user.school_id !== schoolId) {
      throw new ForbiddenException({ code: 'INVALID_USER', message: 'Öğretmen bu okula ait değil.' });
    }
    let assignment = await this.assignmentRepo.findOne({
      where: { schoolId, bilsemCalendarItemId: dto.bilsem_calendar_item_id, userId: dto.user_id },
    });
    if (assignment) {
      assignment.gorevTipi = (dto.gorev_tipi as 'sorumlu' | 'yardimci') ?? assignment.gorevTipi;
      return this.assignmentRepo.save(assignment);
    }
    assignment = this.assignmentRepo.create({
      schoolId,
      bilsemCalendarItemId: dto.bilsem_calendar_item_id,
      userId: dto.user_id,
      gorevTipi: (dto.gorev_tipi as 'sorumlu' | 'yardimci') ?? 'sorumlu',
      createdBy,
    });
    assignment = await this.assignmentRepo.save(assignment);

    await this.notificationsService.createInboxEntry({
      user_id: dto.user_id,
      event_type: 'bilsem_calendar.assigned',
      entity_id: assignment.id,
      target_screen: 'bilsem/takvim',
      title: 'BİLSEM görevlendirmesi',
      body: `"${item.title}" etkinliği için görevlendirildiniz. BİLSEM takvimine giderek detayları görüntüleyebilirsiniz.`,
      metadata: { itemId: item.id, itemTitle: item.title },
    });

    const teacherLabel = user.display_name ?? user.email ?? 'Öğretmen';
    await this.notificationsService.createInboxEntry({
      user_id: createdBy,
      event_type: 'bilsem_calendar.notification_sent',
      entity_id: assignment.id,
      target_screen: 'bilsem/takvim',
      title: 'Bildirim gönderildi',
      body: `"${teacherLabel}" öğretmene "${item.title}" etkinliği için görevlendirme bildirimi iletildi.`,
      metadata: { itemId: item.id, itemTitle: item.title, teacherId: user.id },
    });

    return assignment;
  }

  async deleteAssignment(schoolId: string, id: string): Promise<void> {
    const g = await this.assignmentRepo.findOne({ where: { id, schoolId } });
    if (!g) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Görevlendirme bulunamadı.' });
    await this.assignmentRepo.remove(g);
  }

  async listSchoolTeachers(schoolId: string): Promise<{ id: string; display_name: string | null }[]> {
    const users = await this.userRepo.find({
      where: { school_id: schoolId, role: UserRole.teacher },
      select: ['id', 'display_name'],
      order: { display_name: 'ASC' },
    });
    return users.map((u) => ({ id: u.id, display_name: u.display_name }));
  }

  /** Öğretmenin tarih aralığındaki BİLSEM görevlendirmeleri (ajanda takvimi için) */
  async getTeacherAssignmentsForDateRange(
    schoolId: string,
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<Array<{ id: string; title: string; dateStart: string; gorevTipi: string }>> {
    const weeks = await this.workCalendarService.findWeeksInDateRange(startDate, endDate);
    if (weeks.length === 0) return [];
    const weekIds = weeks.map((w) => w.id);
    const items = await this.calendarItemRepo.find({
      where: { weekId: In(weekIds), isActive: true },
      relations: ['workCalendar'],
    });
    const itemIds = items.map((i) => i.id);
    if (itemIds.length === 0) return [];
    const gorevler = await this.assignmentRepo.find({
      where: { schoolId, userId, bilsemCalendarItemId: In(itemIds) },
      relations: ['bilsemCalendarItem', 'bilsemCalendarItem.workCalendar'],
    });
    const itemById = new Map(items.map((i) => [i.id, i]));
    return gorevler.map((g) => {
      const item = itemById.get(g.bilsemCalendarItemId) ?? g.bilsemCalendarItem;
      const wc = item?.workCalendar;
      const dateStart = wc?.weekStart ?? '';
      return {
        id: g.id,
        title: item?.title ?? 'BİLSEM',
        dateStart,
        gorevTipi: g.gorevTipi ?? 'sorumlu',
      };
    });
  }
}
