import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  WorkCalendarService,
  YILLIK_PLAN_MAX_WEEK_ORDER,
  weekOrderBoundsFromCalendar,
} from '../work-calendar/work-calendar.service';
import { applyBilsemPuyMergeRowDefaults } from './bilsem-puy-plan-constants';
import { WorkCalendar } from '../work-calendar/entities/work-calendar.entity';
import { getAyForWeek, hasMebCalendar, mebTeachingWeeksAsWorkCalendar } from '../config/meb-calendar';
import { BilsemOutcomeSet } from './entities/bilsem-outcome-set.entity';
import { BilsemOutcomeItem } from './entities/bilsem-outcome-item.entity';
import { repairBilsemCografyaPuyItemIfCorrupt } from './bilsem-cografya-puy-canonical';

export type BilsemPlanScope = 'yillik' | 'donem_1' | 'donem_2';

/** API gövdesi (snake_case veya camelCase) */
export type BilsemOutcomeItemInput = {
  description: string;
  week_order?: number | null;
  weekOrder?: number | null;
  unite?: string | null;
  code?: string | null;
  sort_order?: number;
  sortOrder?: number;
  ay?: string | null;
  ders_saati?: number | null;
  dersSaati?: number | null;
  konu?: string | null;
  surec_bilesenleri?: string | null;
  surecBilesenleri?: string | null;
  olcme_degerlendirme?: string | null;
  olcmeDegerlendirme?: string | null;
  sosyal_duygusal?: string | null;
  sosyalDuygusal?: string | null;
  degerler?: string | null;
  okuryazarlik?: string | null;
  belirli_gun_hafta?: string | null;
  belirliGunHafta?: string | null;
  programlar_arasi?: string | null;
  programlarArasi?: string | null;
};

export interface BilsemYillikDraftInput {
  outcome_set_id: string;
  selected_outcome_item_ids: string[];
  academic_year: string;
  plan_scope: BilsemPlanScope;
  weekly_lesson_hours?: number;
}

const DONEM_1_LAST_WEEK = 18;

@Injectable()
export class BilsemYillikPlanService {
  constructor(
    @InjectRepository(BilsemOutcomeSet)
    private readonly setRepo: Repository<BilsemOutcomeSet>,
    @InjectRepository(BilsemOutcomeItem)
    private readonly itemRepo: Repository<BilsemOutcomeItem>,
    private readonly workCalendarService: WorkCalendarService,
  ) {}

  async listOutcomeSets(filters: {
    subject_code?: string;
    academic_year?: string;
    grade?: number;
  }): Promise<BilsemOutcomeSet[]> {
    const qb = this.setRepo.createQueryBuilder('s').orderBy('s.created_at', 'DESC');
    const sc = filters.subject_code?.trim();
    if (sc) {
      qb.andWhere('(s.subject_code = :sc OR s.subject_code IS NULL OR s.subject_code = \'\')', { sc });
    }
    const ay = filters.academic_year?.trim();
    if (ay) qb.andWhere('(s.academic_year IS NULL OR s.academic_year = :ay)', { ay });
    if (filters.grade != null && Number.isFinite(filters.grade)) {
      qb.andWhere('(s.grade IS NULL OR s.grade = :g)', { g: filters.grade });
    }
    return qb.getMany();
  }

  async getOutcomeSetWithItems(id: string): Promise<BilsemOutcomeSet & { items: BilsemOutcomeItem[] }> {
    const set = await this.setRepo.findOne({ where: { id } });
    if (!set) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Kazanım şablonu bulunamadı.' });
    const items = await this.itemRepo.find({
      where: { bilsemOutcomeSetId: id },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    if (set.subjectCode === 'bilsem_cografya') {
      for (const item of items) {
        repairBilsemCografyaPuyItemIfCorrupt(item);
      }
    }
    for (const item of items) {
      if (!item.unite?.trim() && item.programlarArasi?.trim()) {
        item.unite = item.programlarArasi;
        item.programlarArasi = null;
      }
    }
    return Object.assign(set, { items });
  }

  async createOutcomeSet(body: {
    yetenek_alani?: string;
    yetenek_label?: string | null;
    grup_adi?: string | null;
    grade?: number | null;
    academic_year?: string | null;
    subject_code?: string | null;
    subject_label?: string | null;
    items?: BilsemOutcomeItemInput[];
  }): Promise<BilsemOutcomeSet & { items: BilsemOutcomeItem[] }> {
    const entity = this.setRepo.create({
      yetenekAlani: body.yetenek_alani?.trim() ?? '',
      yetenekLabel: body.yetenek_label?.trim() || null,
      grupAdi: body.grup_adi?.trim() || null,
      grade: body.grade ?? null,
      academicYear: body.academic_year?.trim() || null,
      subjectCode: body.subject_code?.trim() || null,
      subjectLabel: body.subject_label?.trim() || null,
    });
    const saved = await this.setRepo.save(entity);
    const itemsIn = body.items ?? [];
    const itemEntities = itemsIn.map((it, idx) =>
      this.itemRepo.create({
        bilsemOutcomeSetId: saved.id,
        weekOrder: it.week_order ?? it.weekOrder ?? null,
        unite: it.unite?.trim() || null,
        code: it.code?.trim() || null,
        description: String(it.description ?? '').trim(),
        sortOrder: it.sort_order ?? it.sortOrder ?? idx,
        ay: it.ay?.trim() || null,
        dersSaati: it.ders_saati ?? it.dersSaati ?? 2,
        konu: it.konu?.trim() || null,
        surecBilesenleri: (it.surec_bilesenleri ?? it.surecBilesenleri)?.trim() || null,
        olcmeDegerlendirme: (it.olcme_degerlendirme ?? it.olcmeDegerlendirme)?.trim() || null,
        sosyalDuygusal: (it.sosyal_duygusal ?? it.sosyalDuygusal)?.trim() || null,
        degerler: it.degerler?.trim() || null,
        okuryazarlik: it.okuryazarlik?.trim() || null,
        belirliGunHafta: (it.belirli_gun_hafta ?? it.belirliGunHafta)?.trim() || null,
        programlarArasi: (it.programlar_arasi ?? it.programlarArasi)?.trim() || null,
      }),
    );
    const savedItems = itemEntities.length ? await this.itemRepo.save(itemEntities) : [];
    return Object.assign(saved, { items: savedItems });
  }

  async updateOutcomeSetMeta(
    id: string,
    body: Partial<{
      yetenek_alani: string;
      yetenek_label: string | null;
      grup_adi: string | null;
      grade: number | null;
      academic_year: string | null;
      subject_code: string | null;
      subject_label: string | null;
    }>,
  ): Promise<BilsemOutcomeSet> {
    const set = await this.setRepo.findOne({ where: { id } });
    if (!set) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Kazanım şablonu bulunamadı.' });
    if (body.yetenek_alani !== undefined) set.yetenekAlani = body.yetenek_alani.trim();
    if (body.yetenek_label !== undefined) set.yetenekLabel = body.yetenek_label?.trim() || null;
    if (body.grup_adi !== undefined) set.grupAdi = body.grup_adi?.trim() || null;
    if (body.grade !== undefined) set.grade = body.grade;
    if (body.academic_year !== undefined) set.academicYear = body.academic_year?.trim() || null;
    if (body.subject_code !== undefined) set.subjectCode = body.subject_code?.trim() || null;
    if (body.subject_label !== undefined) set.subjectLabel = body.subject_label?.trim() || null;
    return this.setRepo.save(set);
  }

  async deleteOutcomeSet(id: string): Promise<void> {
    const res = await this.setRepo.delete({ id });
    if (!res.affected) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Kazanım şablonu bulunamadı.' });
  }

  async upsertItems(setId: string, items: BilsemOutcomeItemInput[]): Promise<BilsemOutcomeItem[]> {
    const set = await this.setRepo.findOne({ where: { id: setId } });
    if (!set) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Kazanım şablonu bulunamadı.' });
    await this.itemRepo.delete({ bilsemOutcomeSetId: setId });
    const itemEntities = (items ?? []).map((it, idx) =>
      this.itemRepo.create({
        bilsemOutcomeSetId: setId,
        weekOrder: it.week_order ?? it.weekOrder ?? null,
        unite: it.unite?.trim() || null,
        code: it.code?.trim() || null,
        description: String(it.description ?? '').trim(),
        sortOrder: it.sort_order ?? it.sortOrder ?? idx,
        ay: it.ay?.trim() || null,
        dersSaati: it.ders_saati ?? it.dersSaati ?? 2,
        konu: it.konu?.trim() || null,
        surecBilesenleri: (it.surec_bilesenleri ?? it.surecBilesenleri)?.trim() || null,
        olcmeDegerlendirme: (it.olcme_degerlendirme ?? it.olcmeDegerlendirme)?.trim() || null,
        sosyalDuygusal: (it.sosyal_duygusal ?? it.sosyalDuygusal)?.trim() || null,
        degerler: it.degerler?.trim() || null,
        okuryazarlik: it.okuryazarlik?.trim() || null,
        belirliGunHafta: (it.belirli_gun_hafta ?? it.belirliGunHafta)?.trim() || null,
        programlarArasi: (it.programlar_arasi ?? it.programlarArasi)?.trim() || null,
      }),
    );
    return itemEntities.length ? this.itemRepo.save(itemEntities) : [];
  }

  parseDraftJson(raw: string): BilsemYillikDraftInput {
    let o: unknown;
    try {
      o = JSON.parse(raw);
    } catch {
      throw new BadRequestException({ code: 'BILSEM_DRAFT_JSON', message: 'Geçersiz plan taslağı.' });
    }
    if (!o || typeof o !== 'object') {
      throw new BadRequestException({ code: 'BILSEM_DRAFT_JSON', message: 'Geçersiz plan taslağı.' });
    }
    const d = o as Record<string, unknown>;
    const outcome_set_id = String(d.outcome_set_id ?? '').trim();
    const academic_year = String(d.academic_year ?? '').trim();
    const plan_scope = String(d.plan_scope ?? '').trim() as BilsemPlanScope;
    const ids = d.selected_outcome_item_ids;
    if (!outcome_set_id || !academic_year) {
      throw new BadRequestException({ code: 'BILSEM_DRAFT_INVALID', message: 'Şablon ve öğretim yılı zorunlu.' });
    }
    if (!['yillik', 'donem_1', 'donem_2'].includes(plan_scope)) {
      throw new BadRequestException({ code: 'BILSEM_DRAFT_INVALID', message: 'Geçersiz plan kapsamı.' });
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException({ code: 'BILSEM_DRAFT_INVALID', message: 'En az bir kazanım seçilmelidir.' });
    }
    const selected_outcome_item_ids = ids.map((x) => String(x).trim()).filter(Boolean);
    const weekly_lesson_hours =
      d.weekly_lesson_hours != null && d.weekly_lesson_hours !== ''
        ? Math.max(1, Math.min(20, parseInt(String(d.weekly_lesson_hours), 10) || 2))
        : undefined;
    return {
      outcome_set_id,
      selected_outcome_item_ids,
      academic_year,
      plan_scope,
      weekly_lesson_hours,
    };
  }

  async buildHaftalarFromDraft(input: BilsemYillikDraftInput): Promise<Record<string, unknown>[]> {
    const { outcome_set_id, selected_outcome_item_ids, academic_year, plan_scope, weekly_lesson_hours } = input;
    const set = await this.getOutcomeSetWithItems(outcome_set_id);
    const byId = new Map(set.items.map((i) => [i.id, i]));
    const selected: BilsemOutcomeItem[] = [];
    for (const id of selected_outcome_item_ids) {
      const it = byId.get(id);
      if (!it) {
        throw new BadRequestException({
          code: 'BILSEM_ITEM_NOT_IN_SET',
          message: 'Seçilen kazanımlar bu şablona ait değil.',
        });
      }
      selected.push(it);
    }
    selected.sort((a, b) => {
      const sa = Number.isFinite(a.sortOrder) ? a.sortOrder : Number.MAX_SAFE_INTEGER;
      const sb = Number.isFinite(b.sortOrder) ? b.sortOrder : Number.MAX_SAFE_INTEGER;
      if (sa !== sb) return sa - sb;
      return a.id.localeCompare(b.id);
    });
    if (selected.length === 0) {
      throw new BadRequestException({ code: 'BILSEM_NO_ITEMS', message: 'Kazanım seçilmedi.' });
    }

    const calendarDb = await this.workCalendarService.findAll(academic_year);
    let planCalWeeks = this.workCalendarService.sortWeeksLikeFindAll(
      calendarDb.filter((w) => w.weekOrder >= 1 && w.weekOrder <= YILLIK_PLAN_MAX_WEEK_ORDER),
    );
    if (planCalWeeks.length === 0 && hasMebCalendar(academic_year)) {
      const meb = mebTeachingWeeksAsWorkCalendar(academic_year);
      if (meb.length) planCalWeeks = this.workCalendarService.sortWeeksLikeFindAll(meb);
    }

    const bounds = weekOrderBoundsFromCalendar(planCalWeeks);
    let weekRange: { min: number; max: number } | undefined;
    if (plan_scope === 'yillik') {
      weekRange = undefined;
    } else if (plan_scope === 'donem_1') {
      if (bounds) {
        const lo = Math.max(1, bounds.min);
        const hi = Math.min(DONEM_1_LAST_WEEK, bounds.max);
        weekRange = lo <= hi ? { min: lo, max: hi } : { min: 1, max: DONEM_1_LAST_WEEK };
      } else {
        weekRange = { min: 1, max: DONEM_1_LAST_WEEK };
      }
    } else {
      const semLo = DONEM_1_LAST_WEEK + 1;
      if (bounds) {
        const lo = Math.max(semLo, bounds.min);
        const hi = Math.min(YILLIK_PLAN_MAX_WEEK_ORDER, bounds.max);
        weekRange = lo <= hi ? { min: lo, max: hi } : { min: semLo, max: YILLIK_PLAN_MAX_WEEK_ORDER };
      } else {
        weekRange = { min: semLo, max: YILLIK_PLAN_MAX_WEEK_ORDER };
      }
    }
    const calendarWeeks = this.workCalendarService.buildOrderedWeeksForPlanMerge(
      planCalWeeks,
      0,
      weekRange,
    ).weeks;

    if (calendarWeeks.length === 0) {
      return [];
    }

    // Ara tatilleri (weekOrder=0, isTatil) öğretim haftaları arasına ekle
    const allSorted = this.workCalendarService.sortWeeksLikeFindAll(calendarDb);
    const holidaysToInsert: { afterWo: number; row: WorkCalendar }[] = [];
    for (let i = 0; i < allSorted.length; i++) {
      const w = allSorted[i];
      if (w.weekOrder !== 0 || !w.isTatil) continue;
      let prevWo = 0;
      for (let j = i - 1; j >= 0; j--) {
        if (allSorted[j].weekOrder >= 1) { prevWo = allSorted[j].weekOrder; break; }
      }
      if (prevWo < 1) continue;
      const lastWo = calendarWeeks[calendarWeeks.length - 1]?.weekOrder ?? 0;
      if (prevWo > lastWo) continue;
      holidaysToInsert.push({ afterWo: prevWo, row: w });
    }
    for (let h = holidaysToInsert.length - 1; h >= 0; h--) {
      const { afterWo, row } = holidaysToInsert[h];
      let insertAt = -1;
      for (let i = calendarWeeks.length - 1; i >= 0; i--) {
        if (calendarWeeks[i].weekOrder === afterWo) { insertAt = i + 1; break; }
      }
      if (insertAt >= 0) calendarWeeks.splice(insertAt, 0, row);
    }

    const weekLabelMap = new Map<string, string>();
    const weekAyMap = new Map<string, string>();
    const weekTatilMap = new Map<string, { isTatil: boolean; tatilLabel: string | null }>();
    const fillMaps = (rows: WorkCalendar[]) => {
      for (const w of rows) {
        if (w.weekOrder < 1) continue;
        const k = `${academic_year}:${w.weekOrder}`;
        if (w.haftaLabel) weekLabelMap.set(k, w.haftaLabel);
        if (w.ay) weekAyMap.set(k, w.ay);
        weekTatilMap.set(k, { isTatil: w.isTatil ?? false, tatilLabel: w.tatilLabel ?? null });
      }
    };
    fillMaps(calendarDb);
    fillMaps(planCalWeeks);

    const teachingIdx: number[] = [];
    calendarWeeks.forEach((w, i) => {
      if (!w.isTatil) teachingIdx.push(i);
    });
    const T = teachingIdx.length;
    const n = selected.length;
    if (T === 0) {
      return calendarWeeks.map((w) => {
        const row = this.emptyRowForWeek(w, academic_year, weekLabelMap, weekAyMap, weekTatilMap);
        applyBilsemPuyMergeRowDefaults(row, w.weekOrder);
        return row;
      });
    }

    const defaultHours = weekly_lesson_hours ?? selected[0]?.dersSaati ?? 2;
    const rowForTeachingIndex = (tPos: number): Record<string, unknown> => {
      let start = Math.floor((tPos * n) / T);
      let end = Math.floor(((tPos + 1) * n) / T);
      if (end <= start) end = start + 1;
      start = Math.min(start, n - 1);
      end = Math.min(end, n);
      const slice = selected.slice(start, end);
      const parts = slice.length > 0 ? slice : [selected[Math.min(Math.max(0, start), n - 1)]];
      const ogrenme = parts
        .map((it) => {
          const c = (it.code ?? '').trim();
          const d = (it.description ?? '').trim();
          return c ? `${c}\n${d}` : d;
        })
        .filter(Boolean)
        .join('\n\n');
      const uniteJ = this.joinField(parts, 'unite');
      const konuJ = this.joinField(parts, 'konu');
      const { unite, konu } = this.fillUniteKonuFromOutcome(parts, uniteJ, konuJ);
      return {
        unite,
        konu,
        ogrenme_ciktilari: ogrenme,
        surec_bilesenleri: this.joinField(parts, 'surecBilesenleri'),
        olcme_degerlendirme: this.joinField(parts, 'olcmeDegerlendirme'),
        sosyal_duygusal: this.joinField(parts, 'sosyalDuygusal'),
        degerler: this.joinField(parts, 'degerler'),
        okuryazarlik_becerileri: this.joinField(parts, 'okuryazarlik'),
        belirli_gun_haftalar: this.joinField(parts, 'belirliGunHafta'),
        zenginlestirme: this.joinField(parts, 'programlarArasi'),
        okul_temelli_planlama: '',
        ders_saati: String(defaultHours),
      };
    };

    let teachCursor = 0;
    return calendarWeeks.map((w) => {
      const isHolidayRow = w.weekOrder === 0 && (w.isTatil ?? false);
      const key = `${academic_year}:${w.weekOrder}`;
      const tatil = isHolidayRow ? undefined : weekTatilMap.get(key);
      const haftaLabel = w.haftaLabel || weekLabelMap.get(key) || (w.tatilLabel ?? `${w.weekOrder}. Hafta`);
      const isTatil = isHolidayRow || (tatil?.isTatil ?? w.isTatil) || false;
      const tatilLabel = w.tatilLabel || (tatil?.tatilLabel ?? '');
      const isSinav = /s[iı]nav/i.test(haftaLabel);
      let ay = w.ay || weekAyMap.get(key) || '';
      if (!ay) ay = getAyForWeek(academic_year, w.weekOrder);

      if (isTatil) {
        const row: Record<string, unknown> = {
          ay,
          hafta_label: haftaLabel,
          is_tatil: true,
          tatil_label: tatilLabel,
          is_special: true,
          ders_saati: '0',
          unite: '',
          konu: tatilLabel || 'Tatil',
          ogrenme_ciktilari: '',
          surec_bilesenleri: '',
          olcme_degerlendirme: '',
          sosyal_duygusal: '',
          degerler: '',
          okuryazarlik_becerileri: '',
          belirli_gun_haftalar: '',
          zenginlestirme: '',
          okul_temelli_planlama: '',
        };
        return row;
      }

      const content = rowForTeachingIndex(teachCursor);
      teachCursor += 1;
      applyBilsemPuyMergeRowDefaults(content, w.weekOrder, {
        unite: String(content.unite ?? ''),
        konu: String(content.konu ?? ''),
        kazanimlar: String(content.ogrenme_ciktilari ?? ''),
      });
      const uniteStr = String(content.unite ?? '').trim();
      const isDiger = !uniteStr;
      return {
        ay,
        hafta_label: haftaLabel,
        is_tatil: false,
        tatil_label: tatilLabel,
        is_special: isSinav || !!tatilLabel || isDiger,
        ...content,
      };
    });
  }

  private emptyRowForWeek(
    w: WorkCalendar,
    academicYear: string,
    weekLabelMap: Map<string, string>,
    weekAyMap: Map<string, string>,
    weekTatilMap: Map<string, { isTatil: boolean; tatilLabel: string | null }>,
  ): Record<string, unknown> {
    const key = `${academicYear}:${w.weekOrder}`;
    const tatil = weekTatilMap.get(key);
    const haftaLabel = weekLabelMap.get(key) ?? `${w.weekOrder}. Hafta`;
    const ay = weekAyMap.get(key) ?? getAyForWeek(academicYear, w.weekOrder);
    return {
      ay,
      hafta_label: haftaLabel,
      is_tatil: tatil?.isTatil ?? false,
      tatil_label: tatil?.tatilLabel ?? '',
      is_special: true,
      ders_saati: '0',
      unite: '',
      konu: '',
      ogrenme_ciktilari: '',
      surec_bilesenleri: '',
      olcme_degerlendirme: '',
      sosyal_duygusal: '',
      degerler: '',
      okuryazarlik_becerileri: '',
      belirli_gun_haftalar: '',
      zenginlestirme: '',
      okul_temelli_planlama: '',
    };
  }

  private joinField(items: BilsemOutcomeItem[], key: keyof BilsemOutcomeItem): string {
    const vals = items
      .map((i) => String((i[key] as string | null | undefined) ?? '').trim())
      .filter(Boolean);
    if (vals.length <= 1) return vals[0] ?? '';
    const unique = [...new Set(vals)];
    if (unique.length === 1) return unique[0];
    const seen = new Set<string>();
    const lines: string[] = [];
    for (const block of unique) {
      for (const line of block.split(/\r?\n/)) {
        const t = line.trim();
        if (t && !seen.has(t)) { seen.add(t); lines.push(t); }
      }
    }
    return lines.join('\n');
  }

  /** Kazanım şablonunda ünite/konu boşsa kod ve açıklamadan türet (evrakta sütunlar dolu görünsün). */
  private fillUniteKonuFromOutcome(
    parts: BilsemOutcomeItem[],
    uniteJoined: string,
    konuJoined: string,
  ): { unite: string; konu: string } {
    let unite = uniteJoined.trim();
    let konu = konuJoined.trim();
    if (unite && konu) return { unite, konu };
    // Ünite/Tema boşken açıklama ilk satırını yazmadan önce `konu` alanını kullan (kazanım cümlesi üniteye gitmesin)
    if (!unite && konu) {
      unite = konu;
      konu = '';
    }
    const codeLine = parts.map((p) => (p.code ?? '').trim()).filter(Boolean).join(', ');
    const descAll = parts.map((p) => String(p.description ?? '').trim()).filter(Boolean).join('\n\n');
    const lines = descAll.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    const firstLine = lines[0] ?? '';
    const outcomeCodeLike = /^[A-ZÇĞİÖŞÜ]{2,}\.[A-ZÇĞİÖŞÜ]{2,}\.\d+(?:\.\d+)*$/u;
    const firstMeaningfulLine = lines.find((l) => !outcomeCodeLike.test(l)) ?? firstLine;
    if (!unite) unite = firstMeaningfulLine.slice(0, 280);
    if (!konu) {
      const firstIdx = lines.findIndex((l) => l === firstMeaningfulLine);
      const rest = firstIdx >= 0 ? lines.filter((_, idx) => idx !== firstIdx) : lines.slice(1);
      konu = rest.join('\n').trim() || descAll || codeLine || firstLine;
    }
    if (unite && !konu && descAll.length > unite.length) konu = descAll.slice(unite.length).trim() || descAll;
    return { unite, konu };
  }
}
