import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
import { UserRole } from '../types/enums';
import { BilsemGeneratedPlan } from './entities/bilsem-generated-plan.entity';
import { YillikPlanIcerikService } from '../yillik-plan-icerik/yillik-plan-icerik.service';

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
  zenginlestirme?: string | null;
  okul_temelli_planlama?: string | null;
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
    @InjectRepository(BilsemGeneratedPlan)
    private readonly generatedPlanRepo: Repository<BilsemGeneratedPlan>,
    private readonly workCalendarService: WorkCalendarService,
    private readonly yillikPlanIcerikService: YillikPlanIcerikService,
  ) {}

  private buildSubjectCodeAliases(subjectCode: string): string[] {
    const sc = subjectCode.trim();
    if (!sc) return [];
    const out = new Set<string>([sc]);
    const withoutBilsem = sc.replace(/^bilsem_/, '');
    const withoutAlan = sc.replace(/_alan$/, '');
    const plain = withoutBilsem.replace(/_alan$/, '');
    out.add(withoutBilsem);
    out.add(withoutAlan);
    out.add(plain);
    out.add(`bilsem_${plain}`);
    out.add(`bilsem_${plain}_alan`);
    out.delete('');
    return [...out];
  }

  async listOutcomeSets(filters: {
    subject_code?: string;
    academic_year?: string;
    grade?: number;
    viewerUserId?: string;
    viewerRole?: UserRole;
  }): Promise<BilsemOutcomeSet[]> {
    const qb = this.setRepo.createQueryBuilder('s').orderBy('s.created_at', 'DESC');
    if (filters.viewerRole && filters.viewerRole !== UserRole.superadmin) {
      const uid = filters.viewerUserId?.trim();
      if (uid) {
        qb.andWhere('(s.owner_user_id IS NULL OR s.owner_user_id = :vuid)', { vuid: uid });
      }
    }
    const sc = filters.subject_code?.trim();
    if (sc) {
      const subjectCodes = this.buildSubjectCodeAliases(sc);
      qb.andWhere('(s.subject_code IN (:...subjectCodes) OR s.subject_code IS NULL OR s.subject_code = \'\')', {
        subjectCodes,
      });
    }
    const ay = filters.academic_year?.trim();
    if (ay) qb.andWhere('(s.academic_year IS NULL OR s.academic_year = :ay)', { ay });
    if (filters.grade != null && Number.isFinite(filters.grade)) {
      qb.andWhere('(s.grade IS NULL OR s.grade = :g)', { g: filters.grade });
    }
    return qb.getMany();
  }

  private assertOutcomeSetReadable(
    set: BilsemOutcomeSet,
    viewer: { userId: string; role: UserRole },
  ): void {
    if (viewer.role === UserRole.superadmin) return;
    if (!set.ownerUserId) return;
    if (set.ownerUserId === viewer.userId) return;
    throw new ForbiddenException({ code: 'OUTCOME_SET_FORBIDDEN', message: 'Bu kazanım şablonuna erişim yetkiniz yok.' });
  }

  private assertOutcomeSetWritable(
    set: BilsemOutcomeSet,
    viewer: { userId: string; role: UserRole },
  ): void {
    if (viewer.role === UserRole.superadmin) return;
    if (set.ownerUserId && set.ownerUserId === viewer.userId) return;
    if (!set.ownerUserId) {
      throw new ForbiddenException({
        code: 'OUTCOME_SET_READ_ONLY',
        message: 'Hazır şablonları yalnızca süper yönetici düzenleyebilir.',
      });
    }
    throw new ForbiddenException({ code: 'OUTCOME_SET_FORBIDDEN', message: 'Bu şablonu düzenleme yetkiniz yok.' });
  }

  async getOutcomeSetWithItems(
    id: string,
    viewer?: { userId: string; role: UserRole },
  ): Promise<BilsemOutcomeSet & { items: BilsemOutcomeItem[] }> {
    const set = await this.setRepo.findOne({ where: { id } });
    if (!set) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Kazanım şablonu bulunamadı.' });
    if (viewer) this.assertOutcomeSetReadable(set, viewer);
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
    /** Yalnızca içe aktarma; süper yönetici genel API’sinde set edilmez. */
    owner_user_id?: string | null;
  }): Promise<BilsemOutcomeSet & { items: BilsemOutcomeItem[] }> {
    const ownerRaw = body.owner_user_id?.trim();
    const entity = this.setRepo.create({
      yetenekAlani: body.yetenek_alani?.trim() ?? '',
      yetenekLabel: body.yetenek_label?.trim() || null,
      grupAdi: body.grup_adi?.trim() || null,
      grade: body.grade ?? null,
      academicYear: body.academic_year?.trim() || null,
      subjectCode: body.subject_code?.trim() || null,
      subjectLabel: body.subject_label?.trim() || null,
      ownerUserId: ownerRaw || null,
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
        programlarArasi:
          (it.programlar_arasi ?? it.programlarArasi ?? it.okul_temelli_planlama ?? it.zenginlestirme)
            ?.trim() || null,
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
    viewer?: { userId: string; role: UserRole },
  ): Promise<BilsemOutcomeSet> {
    const set = await this.setRepo.findOne({ where: { id } });
    if (!set) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Kazanım şablonu bulunamadı.' });
    if (viewer) this.assertOutcomeSetWritable(set, viewer);
    if (body.yetenek_alani !== undefined) set.yetenekAlani = body.yetenek_alani.trim();
    if (body.yetenek_label !== undefined) set.yetenekLabel = body.yetenek_label?.trim() || null;
    if (body.grup_adi !== undefined) set.grupAdi = body.grup_adi?.trim() || null;
    if (body.grade !== undefined) set.grade = body.grade;
    if (body.academic_year !== undefined) set.academicYear = body.academic_year?.trim() || null;
    if (body.subject_code !== undefined) set.subjectCode = body.subject_code?.trim() || null;
    if (body.subject_label !== undefined) set.subjectLabel = body.subject_label?.trim() || null;
    return this.setRepo.save(set);
  }

  async deleteOutcomeSet(
    id: string,
    viewer?: { userId: string; role: UserRole },
  ): Promise<void> {
    const set = await this.setRepo.findOne({ where: { id } });
    if (!set) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Kazanım şablonu bulunamadı.' });
    if (viewer) this.assertOutcomeSetWritable(set, viewer);
    const res = await this.setRepo.delete({ id });
    if (!res.affected) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Kazanım şablonu bulunamadı.' });
  }

  async upsertItems(
    setId: string,
    items: BilsemOutcomeItemInput[],
    viewer?: { userId: string; role: UserRole },
  ): Promise<BilsemOutcomeItem[]> {
    const set = await this.setRepo.findOne({ where: { id: setId } });
    if (!set) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Kazanım şablonu bulunamadı.' });
    if (viewer) this.assertOutcomeSetWritable(set, viewer);
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
        programlarArasi:
          (it.programlar_arasi ?? it.programlarArasi ?? it.okul_temelli_planlama ?? it.zenginlestirme)
            ?.trim() || null,
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

  async buildHaftalarFromDraft(
    input: BilsemYillikDraftInput,
    viewer: { userId: string; role: UserRole },
  ): Promise<Record<string, unknown>[]> {
    const { outcome_set_id, selected_outcome_item_ids, academic_year, plan_scope, weekly_lesson_hours } = input;
    const set = await this.getOutcomeSetWithItems(outcome_set_id, viewer);
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
      const parts: BilsemOutcomeItem[] =
        slice.length > 0 ? slice : [selected[Math.min(Math.max(0, start), n - 1)]];
      const ogrenme = parts
        .map((it) => {
          const c = (it.code ?? '').trim();
          const d = (it.description ?? '').trim();
          if (/^W\d+$/i.test(c)) return d;
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
        okul_temelli_planlama: this.joinField(parts, 'programlarArasi'),
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

  async replaceOutcomeSetFromBilsemPlan(params: {
    subject_code: string;
    subject_label?: string | null;
    academic_year: string;
    ana_grup: string;
    items: Array<{
      week_order: number;
      unite?: string | null;
      konu?: string | null;
      kazanimlar?: string | null;
      ders_saati?: number | null;
      surec_bilesenleri?: string | null;
      olcme_degerlendirme?: string | null;
      sosyal_duygusal?: string | null;
      degerler?: string | null;
      okuryazarlik_becerileri?: string | null;
      belirli_gun_haftalar?: string | null;
      zenginlestirme?: string | null;
      okul_temelli_planlama?: string | null;
    }>;
  }): Promise<BilsemOutcomeSet & { items: BilsemOutcomeItem[] }> {
    const subjectCode = String(params.subject_code ?? '').trim();
    const academicYear = String(params.academic_year ?? '').trim();
    const anaGrup = String(params.ana_grup ?? '').trim();
    if (!subjectCode || !academicYear || !anaGrup) {
      throw new BadRequestException({ code: 'BILSEM_OUTCOME_SYNC_INVALID', message: 'Ders, yıl ve ana grup zorunludur.' });
    }
    const rawItems = Array.isArray(params.items) ? params.items : [];
    if (!rawItems.length) {
      throw new BadRequestException({ code: 'BILSEM_OUTCOME_SYNC_EMPTY', message: 'Set üretimi için en az bir satır gerekir.' });
    }
    const sortedItems = [...rawItems].sort((a, b) => Number(a.week_order ?? 0) - Number(b.week_order ?? 0));
    const created = await this.createOutcomeSet({
      yetenek_alani: anaGrup,
      grup_adi: anaGrup,
      academic_year: academicYear,
      subject_code: subjectCode,
      subject_label: params.subject_label?.trim() || subjectCode,
      items: sortedItems.map((r, idx) => {
        const desc =
          String(r.kazanimlar ?? '').trim() ||
          String(r.konu ?? '').trim() ||
          String(r.unite ?? '').trim() ||
          `Hafta ${String(r.week_order ?? idx + 1)}`;
        return {
          week_order: Number(r.week_order ?? idx + 1),
          sort_order: idx,
          code: Number.isFinite(Number(r.week_order)) ? `W${Number(r.week_order)}` : null,
          unite: r.unite ?? null,
          konu: r.konu ?? null,
          description: desc,
          ders_saati: Number(r.ders_saati ?? 2) || 2,
          surec_bilesenleri: r.surec_bilesenleri ?? null,
          olcme_degerlendirme: r.olcme_degerlendirme ?? null,
          sosyal_duygusal: r.sosyal_duygusal ?? null,
          degerler: r.degerler ?? null,
          okuryazarlik: r.okuryazarlik_becerileri ?? null,
          belirli_gun_hafta: r.belirli_gun_haftalar ?? null,
          programlar_arasi: r.okul_temelli_planlama ?? r.zenginlestirme ?? null,
        } satisfies BilsemOutcomeItemInput;
      }),
    });
    const oldSets = await this.setRepo
      .createQueryBuilder('s')
      .select('s.id', 'id')
      .where('s.id != :newId', { newId: created.id })
      .andWhere('s.owner_user_id IS NULL')
      .andWhere('(s.subject_code = :sc OR s.subject_code IS NULL OR s.subject_code = \'\')', { sc: subjectCode })
      .andWhere('(s.academic_year IS NULL OR s.academic_year = :ay)', { ay: academicYear })
      .andWhere('(s.grup_adi IS NULL OR s.grup_adi = :ga)', { ga: anaGrup })
      .getRawMany<{ id: string }>();
    const oldIds = oldSets.map((x) => x.id).filter(Boolean);
    if (oldIds.length) {
      await this.generatedPlanRepo
        .createQueryBuilder()
        .update(BilsemGeneratedPlan)
        .set({ outcomeSetId: created.id })
        .where('outcome_set_id IN (:...oldIds)', { oldIds })
        .execute();
      await this.setRepo.delete(oldIds);
    }
    return created;
  }

  async syncOutcomeSetFromBilsemYillikPlan(params: {
    subject_code: string;
    academic_year: string;
    ana_grup: string;
    alt_grup?: string | null;
    subject_label?: string | null;
  }): Promise<BilsemOutcomeSet & { items: BilsemOutcomeItem[] }> {
    const subjectCode = String(params.subject_code ?? '').trim();
    const academicYear = String(params.academic_year ?? '').trim();
    const anaGrup = String(params.ana_grup ?? '').trim();
    const altGrup = params.alt_grup == null ? undefined : String(params.alt_grup).trim();
    if (!subjectCode || !academicYear || !anaGrup) {
      throw new BadRequestException({
        code: 'BILSEM_OUTCOME_SYNC_INVALID',
        message: 'Ders, yıl ve ana grup zorunludur.',
      });
    }
    const rows = await this.yillikPlanIcerikService.findAll({
      subject_code: subjectCode,
      academic_year: academicYear,
      curriculum_model: 'bilsem',
      ana_grup: anaGrup,
      ...(altGrup !== undefined ? { alt_grup: altGrup } : {}),
    });
    if (!rows.length) {
      throw new BadRequestException({
        code: 'BILSEM_OUTCOME_SYNC_EMPTY',
        message: 'Bu seçim için Bilsem yıllık plan satırı bulunamadı.',
      });
    }
    this.yillikPlanIcerikService.attachBilsemPuyDisplayDefaults(rows);
    return this.replaceOutcomeSetFromBilsemPlan({
      subject_code: subjectCode,
      subject_label: params.subject_label?.trim() || rows[0]?.subjectLabel || subjectCode,
      academic_year: academicYear,
      ana_grup: anaGrup,
      items: rows.map((r) => ({
        week_order: r.weekOrder,
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
    });
  }
}
