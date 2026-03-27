import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AcademicCalendarItem } from './entities/academic-calendar-item.entity';
import { BelirliGunHaftaGorev } from './entities/belirli-gun-hafta-gorev.entity';
import { School } from '../schools/entities/school.entity';
import { User } from '../users/entities/user.entity';
import { WorkCalendarService } from '../work-calendar/work-calendar.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateAcademicCalendarItemDto } from './dto/create-item.dto';
import { UpdateAcademicCalendarItemDto } from './dto/update-item.dto';
import { PatchAcademicCalendarOverridesDto } from './dto/school-overrides.dto';
import { CreateBelirliGunHaftaGorevDto } from './dto/create-assignment.dto';
import { SchoolType, UserRole } from '../types/enums';

export interface AssignedUserView {
  userId: string;
  displayName: string | null;
  gorevTipi: 'sorumlu' | 'yardimci';
}

export interface WeekWithItems {
  id: string;
  academicYear: string;
  weekNumber: number;
  title: string | null;
  dateStart: string | null;
  dateEnd: string | null;
  sortOrder: number;
  belirliGunHafta: ItemView[];
  ogretmenIsleri: ItemView[];
}

export interface ItemView {
  id: string;
  title: string;
  path: string | null;
  iconKey: string | null;
  sortOrder: number;
  /** null/boş = tüm kurumlar */
  schoolTypes?: SchoolType[] | null;
  /** Sadece belirli_gun_hafta için; okul görevlendirmeleri */
  assignedUsers?: AssignedUserView[];
}

@Injectable()
export class AcademicCalendarService {
  constructor(
    @InjectRepository(AcademicCalendarItem)
    private readonly itemRepo: Repository<AcademicCalendarItem>,
    @InjectRepository(BelirliGunHaftaGorev)
    private readonly gorevRepo: Repository<BelirliGunHaftaGorev>,
    @InjectRepository(School)
    private readonly schoolRepo: Repository<School>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly workCalendarService: WorkCalendarService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /** Okul türüne göre şablon öğesi görünür mü (null/[] = herkese) */
  itemVisibleForSchoolType(item: AcademicCalendarItem, schoolType: string | undefined): boolean {
    const st = item.schoolTypes;
    const universal = !st || st.length === 0;
    if (!schoolType) return universal;
    if (universal) return true;
    return st.includes(schoolType as SchoolType);
  }

  /** Teacher, school_admin, superadmin: Hafta bazlı takvim (okul override'ları uygulanmış). */
  async getForViewer(
    academicYear: string,
    schoolId: string | null,
    schoolTypeQuery: string | null | undefined,
    role: UserRole,
  ): Promise<WeekWithItems[]> {
    const workWeeks = await this.workCalendarService.findAll(academicYear.trim());
    if (workWeeks.length === 0) return [];
    const weekIds = workWeeks.map((w) => w.id);
    const items = await this.itemRepo.find({
      where: { weekId: In(weekIds) },
      order: { sortOrder: 'ASC' },
    });
    let schoolType: string | undefined;
    if (schoolId) {
      const school = await this.schoolRepo.findOne({ where: { id: schoolId }, select: ['type'] });
      schoolType = school?.type;
    } else if (role === UserRole.superadmin) {
      const q = schoolTypeQuery?.trim();
      if (q === '' || q === '__global__') schoolType = undefined;
      else schoolType = (q || SchoolType.ilkokul) as string;
    } else {
      schoolType = schoolTypeQuery?.trim() || undefined;
    }
    const filtered = items.filter((i) => this.itemVisibleForSchoolType(i, schoolType));
    const overrides = schoolId ? await this.getSchoolOverrides(schoolId) : null;
    const hiddenIds = new Set(overrides?.hiddenItemIds ?? []);
    const customItems = overrides?.customItems ?? [];
    const belirliItemIds = filtered.filter((i) => i.itemType === 'belirli_gun_hafta').map((i) => i.id);
    const assignments = schoolId && belirliItemIds.length > 0 ? await this.getAssignmentsByItem(schoolId, belirliItemIds) : new Map<string, AssignedUserView[]>();
    return this.buildWeeksWithItems(workWeeks, filtered, hiddenIds, customItems, assignments);
  }

  /** Okul admin: JWT okulunun türü; superadmin: ?school_type boş = yalnızca ortak öğeler, dolu = o tür + ortak. */
  async resolveTemplateSchoolType(
    payload: { role: UserRole; schoolId: string | null },
    schoolTypeQuery: string | undefined,
  ): Promise<string | null> {
    if (payload.schoolId) {
      const school = await this.schoolRepo.findOne({ where: { id: payload.schoolId }, select: ['type'] });
      return school?.type ?? SchoolType.ilkokul;
    }
    const q = schoolTypeQuery?.trim();
    if (q === '' || q === '__global__') return null;
    return (q || SchoolType.ilkokul) as string;
  }

  /** Ham şablon (override yok). schoolType null = yalnızca tüm kurumlara açık öğeler. */
  async getTemplate(academicYear: string, schoolType: string | null): Promise<WeekWithItems[]> {
    const workWeeks = await this.workCalendarService.findAll(academicYear.trim());
    if (workWeeks.length === 0) return [];
    const weekIds = workWeeks.map((w) => w.id);
    const items = await this.itemRepo.find({
      where: { weekId: In(weekIds) },
      order: { sortOrder: 'ASC' },
    });
    const filtered =
      schoolType === null
        ? items.filter((i) => !i.schoolTypes?.length)
        : items.filter((i) => this.itemVisibleForSchoolType(i, schoolType));
    return this.buildWeeksWithItems(workWeeks, filtered, new Set(), [], new Map());
  }

  private async getAssignmentsByItem(
    schoolId: string,
    itemIds: string[],
  ): Promise<Map<string, AssignedUserView[]>> {
    if (itemIds.length === 0) return new Map();
    const gorevler = await this.gorevRepo.find({
      where: { schoolId, academicCalendarItemId: In(itemIds) },
      relations: ['user'],
    });
    const map = new Map<string, AssignedUserView[]>();
    for (const g of gorevler) {
      const list = map.get(g.academicCalendarItemId) ?? [];
      list.push({
        userId: g.userId,
        displayName: g.user?.display_name ?? null,
        gorevTipi: g.gorevTipi as 'sorumlu' | 'yardimci',
      });
      map.set(g.academicCalendarItemId, list);
    }
    return map;
  }

  private buildWeeksWithItems(
    workWeeks: Array<{ id: string; academicYear: string; weekOrder: number; weekStart: string; weekEnd: string; ay: string; haftaLabel: string | null; tatilLabel: string | null; isTatil: boolean; sortOrder: number | null }>,
    items: AcademicCalendarItem[],
    hiddenIds: Set<string>,
    customItems: PatchAcademicCalendarOverridesDto['customItems'],
    assignments: Map<string, AssignedUserView[]>,
  ): WeekWithItems[] {
    const itemsByWeek = new Map<string, AcademicCalendarItem[]>();
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
      const belirli: ItemView[] = weekItems
        .filter((i) => i.itemType === 'belirli_gun_hafta' && i.isActive && !hiddenIds.has(i.id))
        .map((i) => ({
          id: i.id,
          title: i.title,
          path: i.path,
          iconKey: i.iconKey,
          sortOrder: i.sortOrder,
          schoolTypes: i.schoolTypes ?? null,
          assignedUsers: assignments.get(i.id) ?? [],
        }));
      const ogretmen: ItemView[] = weekItems
        .filter((i) => i.itemType === 'ogretmen_isleri' && i.isActive && !hiddenIds.has(i.id))
        .map((i) => ({
          id: i.id,
          title: i.title,
          path: i.path,
          iconKey: i.iconKey,
          sortOrder: i.sortOrder,
          schoolTypes: i.schoolTypes ?? null,
        }));
      for (const c of customByWeek.get(w.id) ?? []) {
        const view: ItemView = { id: c.id, title: c.title, path: c.path ?? null, iconKey: null, sortOrder: c.sortOrder };
        if (c.type === 'belirli_gun_hafta') belirli.push(view);
        else ogretmen.push(view);
      }
      belirli.sort((a, b) => a.sortOrder - b.sortOrder);
      ogretmen.sort((a, b) => a.sortOrder - b.sortOrder);
      const title = w.isTatil ? w.tatilLabel : w.haftaLabel;
      const weekNumber = w.weekOrder ?? idx + 1;
      return {
        id: w.id,
        academicYear: w.academicYear,
        weekNumber,
        weekOrder: w.weekOrder,
        ay: w.ay,
        title,
        dateStart: w.weekStart,
        dateEnd: w.weekEnd,
        isTatil: w.isTatil,
        sortOrder: w.sortOrder ?? idx + 1,
        belirliGunHafta: belirli,
        ogretmenIsleri: ogretmen,
      };
    });
  }

  async createItem(dto: CreateAcademicCalendarItemDto): Promise<AcademicCalendarItem> {
    await this.workCalendarService.findOne(dto.week_id);
    const st = dto.school_types?.length ? dto.school_types : null;
    const item = this.itemRepo.create({
      weekId: dto.week_id,
      itemType: dto.item_type,
      title: dto.title,
      path: dto.path ?? null,
      iconKey: dto.icon_key ?? null,
      sortOrder: dto.sort_order ?? 0,
      isActive: dto.is_active ?? true,
      schoolTypes: st,
    });
    return this.itemRepo.save(item);
  }

  async updateItem(id: string, dto: UpdateAcademicCalendarItemDto): Promise<AcademicCalendarItem> {
    const item = await this.itemRepo.findOne({ where: { id } });
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
    if (dto.school_types !== undefined) item.schoolTypes = dto.school_types?.length ? dto.school_types : null;
    return this.itemRepo.save(item);
  }

  async deleteItem(id: string): Promise<void> {
    const item = await this.itemRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Öğe bulunamadı.' });
    item.isActive = false;
    await this.itemRepo.save(item);
  }

  async reorderItems(itemIds: string[]): Promise<void> {
    for (let i = 0; i < itemIds.length; i++) {
      await this.itemRepo.update(itemIds[i], { sortOrder: i });
    }
  }

  async getSchoolOverrides(schoolId: string) {
    const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
    if (!school) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Okul bulunamadı.' });
    const ov = school.academic_calendar_overrides;
    return { hiddenItemIds: ov?.hiddenItemIds ?? [], customItems: ov?.customItems ?? [] };
  }

  async patchSchoolOverrides(schoolId: string, dto: PatchAcademicCalendarOverridesDto): Promise<void> {
    const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
    if (!school) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Okul bulunamadı.' });
    const current = school.academic_calendar_overrides ?? { hiddenItemIds: [], customItems: [] };
    school.academic_calendar_overrides = {
      hiddenItemIds: dto.hiddenItemIds ?? current.hiddenItemIds,
      customItems: dto.customItems ?? current.customItems,
    };
    await this.schoolRepo.save(school);
  }

  /** Öğretmenin tarih aralığındaki Belirli Gün görevlendirmeleri (ajanda takvimi için) */
  async getTeacherAssignmentsForDateRange(
    schoolId: string,
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<Array<{ id: string; title: string; dateStart: string; gorevTipi: string }>> {
    const weeks = await this.workCalendarService.findWeeksInDateRange(startDate, endDate);
    if (weeks.length === 0) return [];
    const school = await this.schoolRepo.findOne({ where: { id: schoolId }, select: ['type'] });
    const schoolType = school?.type;
    const weekIds = weeks.map((w) => w.id);
    const items = await this.itemRepo.find({
      where: { weekId: In(weekIds), itemType: 'belirli_gun_hafta', isActive: true },
      relations: ['workCalendar'],
    });
    const itemsF = items.filter((i) => this.itemVisibleForSchoolType(i, schoolType));
    const itemIds = itemsF.map((i) => i.id);
    if (itemIds.length === 0) return [];
    const gorevler = await this.gorevRepo.find({
      where: { schoolId, userId, academicCalendarItemId: In(itemIds) },
      relations: ['academicCalendarItem', 'academicCalendarItem.workCalendar'],
    });
    const itemById = new Map(itemsF.map((i) => [i.id, i]));
    return gorevler.map((g) => {
      const item = itemById.get(g.academicCalendarItemId) ?? g.academicCalendarItem;
      const wc = item?.workCalendar;
      const dateStart = wc?.weekStart ?? '';
      return {
        id: g.id,
        title: item?.title ?? 'Belirli Gün',
        dateStart,
        gorevTipi: g.gorevTipi ?? 'sorumlu',
      };
    });
  }

  /** Teacher: Kendi Belirli Gün görevlendirmeleri (dashboard için) */
  async getMyAssignments(userId: string, schoolId: string | null, academicYear: string) {
    if (!schoolId) return [];
    const school = await this.schoolRepo.findOne({ where: { id: schoolId }, select: ['type'] });
    const schoolType = school?.type;
    const workWeeks = await this.workCalendarService.findAll(academicYear.trim());
    if (workWeeks.length === 0) return [];
    const weekIds = workWeeks.map((w) => w.id);
    const items = await this.itemRepo.find({
      where: { weekId: In(weekIds), itemType: 'belirli_gun_hafta', isActive: true },
    });
    const itemsF = items.filter((i) => this.itemVisibleForSchoolType(i, schoolType));
    const itemIds = itemsF.map((i) => i.id);
    if (itemIds.length === 0) return [];
    const gorevler = await this.gorevRepo.find({
      where: { schoolId, userId, academicCalendarItemId: In(itemIds) },
      relations: ['academicCalendarItem', 'academicCalendarItem.workCalendar'],
    });
    return gorevler.map((g) => {
      const wc = g.academicCalendarItem?.workCalendar;
      return {
        id: g.id,
        itemId: g.academicCalendarItemId,
        itemTitle: g.academicCalendarItem?.title ?? '',
        weekId: g.academicCalendarItem?.weekId ?? '',
        weekDateStart: wc?.weekStart ?? null,
        weekDateEnd: wc?.weekEnd ?? null,
        weekLabel: wc?.haftaLabel ?? wc?.tatilLabel ?? null,
        gorevTipi: g.gorevTipi,
        sortOrder: wc?.sortOrder ?? 999,
      };
    }).sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
  }

  /** School_admin: Belirli Gün görevlendirmeleri listesi */
  async getAssignments(schoolId: string, academicYear: string) {
    const school = await this.schoolRepo.findOne({ where: { id: schoolId }, select: ['type'] });
    const schoolType = school?.type;
    const workWeeks = await this.workCalendarService.findAll(academicYear.trim());
    if (workWeeks.length === 0) return [];
    const weekIds = workWeeks.map((w) => w.id);
    const items = await this.itemRepo.find({
      where: { weekId: In(weekIds), itemType: 'belirli_gun_hafta', isActive: true },
      order: { sortOrder: 'ASC' },
    });
    const itemsF = items.filter((i) => this.itemVisibleForSchoolType(i, schoolType));
    const itemIds = itemsF.map((i) => i.id);
    if (itemIds.length === 0) return [];
    const gorevler = await this.gorevRepo.find({
      where: { schoolId, academicCalendarItemId: In(itemIds) },
      relations: ['user', 'academicCalendarItem'],
    });
    const weekMap = new Map(workWeeks.map((w) => [w.id, w]));
    return gorevler.map((g) => ({
      id: g.id,
      itemId: g.academicCalendarItemId,
      itemTitle: g.academicCalendarItem?.title ?? '',
      weekId: g.academicCalendarItem?.weekId ?? '',
      userId: g.userId,
      userName: g.user?.display_name ?? g.user?.email ?? '',
      gorevTipi: g.gorevTipi,
    }));
  }

  /** School_admin: Belirli Gün'e öğretmen ata. Bildirim gönderilir. */
  async createAssignment(
    schoolId: string,
    dto: CreateBelirliGunHaftaGorevDto,
    createdBy: string,
  ): Promise<BelirliGunHaftaGorev> {
    const item = await this.itemRepo.findOne({
      where: { id: dto.item_id },
      relations: ['workCalendar'],
    });
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Etkinlik bulunamadı.' });
    if (item.itemType !== 'belirli_gun_hafta')
      throw new ForbiddenException({ code: 'INVALID_ITEM', message: 'Sadece Belirli Gün ve Haftalar etkinliklerine görev atanabilir.' });
    const schoolRow = await this.schoolRepo.findOne({ where: { id: schoolId }, select: ['type'] });
    if (!this.itemVisibleForSchoolType(item, schoolRow?.type))
      throw new ForbiddenException({ code: 'INVALID_ITEM', message: 'Bu etkinlik bu okul türü için geçerli değil.' });

    const teacher = await this.userRepo.findOne({
      where: { id: dto.user_id, school_id: schoolId, role: UserRole.teacher },
    });
    if (!teacher)
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Öğretmen bulunamadı veya bu okulda değil.' });

    let gorev = await this.gorevRepo.findOne({
      where: { schoolId, academicCalendarItemId: dto.item_id, userId: dto.user_id },
    });
    if (gorev) {
      gorev.gorevTipi = (dto.gorev_tipi as 'sorumlu' | 'yardimci') ?? gorev.gorevTipi;
      return this.gorevRepo.save(gorev);
    }

    gorev = this.gorevRepo.create({
      schoolId,
      academicCalendarItemId: dto.item_id,
      userId: dto.user_id,
      gorevTipi: (dto.gorev_tipi as 'sorumlu' | 'yardimci') ?? 'sorumlu',
      createdBy,
    });
    gorev = await this.gorevRepo.save(gorev);

    await this.notificationsService.createInboxEntry({
      user_id: dto.user_id,
      event_type: 'belirli_gun_hafta.assigned',
      entity_id: gorev.id,
      target_screen: 'akademik-takvim',
      title: 'Belirli Gün ve Hafta görevlendirmesi',
      body: `"${item.title}" etkinliği için görevlendirildiniz. Takvime giderek detayları görüntüleyebilirsiniz.`,
      metadata: { itemId: item.id, itemTitle: item.title },
    });

    // Okul adminine: bildirim gönderildi onayı
    const teacherLabel = teacher.display_name || teacher.email || 'Öğretmen';
    await this.notificationsService.createInboxEntry({
      user_id: createdBy,
      event_type: 'belirli_gun_hafta.notification_sent',
      entity_id: gorev.id,
      target_screen: 'akademik-takvim',
      title: 'Bildirim gönderildi',
      body: `"${teacherLabel}" öğretmene "${item.title}" etkinliği için görevlendirme bildirimi iletildi.`,
      metadata: { itemId: item.id, itemTitle: item.title, teacherId: teacher.id },
    });

    return gorev;
  }

  /** School_admin: Görevlendirmeyi kaldır */
  async deleteAssignment(schoolId: string, assignmentId: string): Promise<void> {
    const gorev = await this.gorevRepo.findOne({ where: { id: assignmentId, schoolId } });
    if (!gorev) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Görevlendirme bulunamadı.' });
    await this.gorevRepo.remove(gorev);
  }
}
