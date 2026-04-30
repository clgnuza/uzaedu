import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkCalendar } from './entities/work-calendar.entity';
import { CreateWorkCalendarDto } from './dto/create-work-calendar.dto';
import { UpdateWorkCalendarDto } from './dto/update-work-calendar.dto';

/** Yıllık plan / DOCX: çalışma takvimi + plan (en fazla 36 + 37–38) */
export const YILLIK_PLAN_MAX_WEEK_ORDER = 38;

/** Takvimde tanımlı ilk/son hafta numarası (1–38); boşsa null */
export function weekOrderBoundsFromCalendar(planCalWeeks: WorkCalendar[]): { min: number; max: number } | null {
  const cap = YILLIK_PLAN_MAX_WEEK_ORDER;
  const wo = planCalWeeks.map((w) => w.weekOrder).filter((w) => w >= 1 && w <= cap);
  if (wo.length === 0) return null;
  return { min: Math.min(...wo), max: Math.max(...wo) };
}

@Injectable()
export class WorkCalendarService {
  constructor(
    @InjectRepository(WorkCalendar)
    private readonly repo: Repository<WorkCalendar>,
  ) {}

  async findAll(academicYear?: string): Promise<WorkCalendar[]> {
    const qb = this.repo.createQueryBuilder('wc').orderBy('wc.sort_order', 'ASC').addOrderBy('wc.week_order', 'ASC');
    if (academicYear?.trim()) {
      qb.andWhere('wc.academic_year = :academicYear', { academicYear: academicYear.trim() });
    }
    return qb.getMany();
  }

  /** MEB senkron / findAll ile aynı kronolojik sıra: sort_order (null en sonda), sonra week_order */
  sortWeeksLikeFindAll(weeks: WorkCalendar[]): WorkCalendar[] {
    return [...weeks].sort((a, b) => {
      const ra = a.sortOrder;
      const rb = b.sortOrder;
      if (ra != null && rb != null && ra !== rb) return ra - rb;
      if (ra != null && rb == null) return -1;
      if (ra == null && rb != null) return 1;
      return a.weekOrder - b.weekOrder;
    });
  }

  /**
   * Çalışma takvimi satırları ile plandaki en yüksek haftayı hizalar; takvimde olmayan
   * haftalar için sentetik (tarihsiz) öğretim satırı üretir. 39–40 vb. üst sınır kesilir.
   */
  buildOrderedWeeksForPlanMerge(
    planCalWeeks: WorkCalendar[],
    itemsMaxWeekOrder: number,
    weekRange?: { min: number; max: number },
  ): { maxPlanWeek: number; weeks: WorkCalendar[] } {
    const cap = YILLIK_PLAN_MAX_WEEK_ORDER;
    const isExplicitWindow = !!weekRange;
    let resolvedRange = weekRange;
    if (!resolvedRange) {
      const b = weekOrderBoundsFromCalendar(planCalWeeks);
      if (b) resolvedRange = b;
    }
    const min = Math.max(1, resolvedRange?.min ?? 1);
    const calWindowMax = Math.min(cap, resolvedRange?.max ?? cap);
    const calPool = isExplicitWindow
      ? planCalWeeks.filter((w) => w.weekOrder >= min && w.weekOrder <= calWindowMax)
      : planCalWeeks.filter((w) => w.weekOrder >= 1 && w.weekOrder <= cap);
    const calMax = calPool.length ? Math.max(...calPool.map((w) => w.weekOrder)) : 0;
    /** Eski: Math.min(maxR, …) tüm yılda 37–38’i kesiyordu. Tam yılda plandaki son haftalar tüm takvim satırından büyük olabilir. */
    let maxPlanWeek: number;
    if (isExplicitWindow) {
      maxPlanWeek = Math.min(calWindowMax, Math.max(calMax, itemsMaxWeekOrder, min));
    } else {
      maxPlanWeek = Math.min(cap, Math.max(calMax, itemsMaxWeekOrder, min, calWindowMax));
    }
    const byWo = new Map<number, WorkCalendar>();
    for (const w of calPool) {
      if (w.weekOrder < min || w.weekOrder > maxPlanWeek) continue;
      byWo.set(w.weekOrder, w);
    }
    const weeks: WorkCalendar[] = [];
    for (let wo = min; wo <= maxPlanWeek; wo++) {
      const row = byWo.get(wo);
      weeks.push(row ?? this.syntheticTeachingWeekRow(wo));
    }
    return { maxPlanWeek, weeks };
  }

  private syntheticTeachingWeekRow(weekOrder: number): WorkCalendar {
    const e = new WorkCalendar();
    e.weekOrder = weekOrder;
    e.weekStart = '';
    e.weekEnd = '';
    e.ay = '';
    e.academicYear = '';
    e.haftaLabel = null;
    e.isTatil = false;
    e.tatilLabel = null;
    e.sinavEtiketleri = null;
    e.sortOrder = weekOrder;
    return e;
  }

  /** Tarih aralığıyla kesişen haftalar */
  async findWeeksInDateRange(startDate: string, endDate: string): Promise<WorkCalendar[]> {
    return this.repo
      .createQueryBuilder('wc')
      .where('wc.week_start <= :endDate', { endDate: endDate.slice(0, 10) })
      .andWhere('wc.week_end >= :startDate', { startDate: startDate.slice(0, 10) })
      .orderBy('wc.sort_order', 'ASC')
      .addOrderBy('wc.week_order', 'ASC')
      .getMany();
  }

  async findOne(id: string): Promise<WorkCalendar> {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Kayıt bulunamadı.' });
    }
    return item;
  }

  async create(dto: CreateWorkCalendarDto): Promise<WorkCalendar> {
    const entity = this.repo.create({
      academicYear: dto.academic_year,
      weekOrder: dto.week_order,
      weekStart: dto.week_start,
      weekEnd: dto.week_end,
      ay: dto.ay,
      haftaLabel: dto.hafta_label ?? null,
      isTatil: dto.is_tatil ?? false,
      tatilLabel: dto.tatil_label ?? null,
      sinavEtiketleri: dto.sinav_etiketleri?.trim() || null,
      sortOrder: dto.sort_order ?? null,
    });
    return this.repo.save(entity);
  }

  async update(id: string, dto: UpdateWorkCalendarDto): Promise<WorkCalendar> {
    const entity = await this.findOne(id);
    if (dto.academic_year !== undefined) entity.academicYear = dto.academic_year;
    if (dto.week_order !== undefined) entity.weekOrder = dto.week_order;
    if (dto.week_start !== undefined) entity.weekStart = dto.week_start;
    if (dto.week_end !== undefined) entity.weekEnd = dto.week_end;
    if (dto.ay !== undefined) entity.ay = dto.ay;
    if (dto.hafta_label !== undefined) entity.haftaLabel = dto.hafta_label;
    if (dto.is_tatil !== undefined) entity.isTatil = dto.is_tatil;
    if (dto.tatil_label !== undefined) entity.tatilLabel = dto.tatil_label;
    if (dto.sinav_etiketleri !== undefined) entity.sinavEtiketleri = dto.sinav_etiketleri?.trim() || null;
    if (dto.sort_order !== undefined) entity.sortOrder = dto.sort_order;
    return this.repo.save(entity);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.repo.delete(id);
  }

  /** Öğretim yılına göre toplu silme. */
  async bulkDelete(academicYear: string): Promise<number> {
    if (!academicYear?.trim()) return 0;
    const result = await this.repo.delete({ academicYear: academicYear.trim() });
    return result.affected ?? 0;
  }

  /** MEB senkronu – mevcut haftaları günceller, eksikleri ekler. Silme yok (academic_calendar_item CASCADE korunur). */
  async syncFromMebUpsert(
    academicYear: string,
    items: Array<{
      week_order: number;
      week_start: string;
      week_end: string;
      ay: string;
      hafta_label?: string | null;
      is_tatil?: boolean;
      tatil_label?: string | null;
      sinav_etiketleri?: string | null;
      sort_order?: number | null;
    }>,
  ): Promise<{ created: number; updated: number }> {
    const year = academicYear.trim();
    const existing = await this.repo.find({ where: { academicYear: year } });
    const byDateKey = new Map<string, WorkCalendar>();
    for (const e of existing) {
      byDateKey.set(`${e.weekStart}|${e.weekEnd}`, e);
    }
    let created = 0;
    let updated = 0;
    for (let idx = 0; idx < items.length; idx++) {
      const it = items[idx];
      const key = `${it.week_start}|${it.week_end}`;
      const found = byDateKey.get(key);
      if (found) {
        found.weekOrder = it.week_order;
        found.ay = it.ay;
        found.haftaLabel = it.hafta_label?.trim() || null;
        found.isTatil = it.is_tatil ?? false;
        found.tatilLabel = it.tatil_label?.trim() || null;
        found.sinavEtiketleri = it.sinav_etiketleri?.trim() || null;
        found.sortOrder = it.sort_order ?? idx + 1;
        await this.repo.save(found);
        updated++;
      } else {
        const entity = this.repo.create({
          academicYear: year,
          weekOrder: it.week_order,
          weekStart: it.week_start,
          weekEnd: it.week_end,
          ay: it.ay,
          haftaLabel: it.hafta_label?.trim() || null,
          isTatil: it.is_tatil ?? false,
          tatilLabel: it.tatil_label?.trim() || null,
          sinavEtiketleri: it.sinav_etiketleri?.trim() || null,
          sortOrder: it.sort_order ?? idx + 1,
        });
        await this.repo.save(entity);
        byDateKey.set(key, entity);
        created++;
      }
    }
    return { created, updated };
  }

  /** GPT taslağından veya toplu import'tan kayıt oluştur. Aynı yıl için mevcut kayıtlar silinir. */
  async bulkCreate(
    academicYear: string,
    items: Array<{
      week_order: number;
      week_start: string;
      week_end: string;
      ay: string;
      hafta_label?: string | null;
      is_tatil?: boolean;
      tatil_label?: string | null;
      sinav_etiketleri?: string | null;
      sort_order?: number | null;
    }>,
  ): Promise<WorkCalendar[]> {
    await this.repo.delete({ academicYear: academicYear.trim() });
    const entities = items.map((item, idx) =>
      this.repo.create({
        academicYear: academicYear.trim(),
        weekOrder: item.week_order,
        weekStart: item.week_start,
        weekEnd: item.week_end,
        ay: item.ay,
        haftaLabel: item.hafta_label?.trim() || null,
        isTatil: item.is_tatil ?? false,
        tatilLabel: item.tatil_label?.trim() || null,
        sinavEtiketleri: item.sinav_etiketleri?.trim() || null,
        sortOrder: item.sort_order ?? idx + 1,
      }),
    );
    return this.repo.save(entities);
  }
}
