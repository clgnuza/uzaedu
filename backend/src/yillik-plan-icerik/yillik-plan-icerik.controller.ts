import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { RequireSchoolModuleGuard } from '../common/guards/require-school-module.guard';
import { RequireSchoolModule } from '../common/decorators/require-school-module.decorator';
import { RequireModuleActivationGuard } from '../market/guards/require-module-activation.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../types/enums';
import { YillikPlanIcerikService } from './yillik-plan-icerik.service';
import { WorkCalendarService } from '../work-calendar/work-calendar.service';
import { CreateYillikPlanIcerikDto } from './dto/create-yillik-plan-icerik.dto';
import { UpdateYillikPlanIcerikDto } from './dto/update-yillik-plan-icerik.dto';
import { MebFetchService, ParsedPlanRow } from '../meb/meb-fetch.service';
import { generateMebWorkCalendar, hasMebCalendar } from '../config/meb-calendar';
import { getDersSaatiStatic } from '../config/ders-saati';
import { resolveAyForYillikPlanRow } from './resolve-ay-for-plan-row.util';

/** Admin sayfası çoklu GET (liste, özet, meta, MEB listesi…) + React Strict Mode çift çağrı; global throttle 429 üretmesin. */
@Controller('yillik-plan-icerik')
@SkipThrottle({ default: true, auth: true, public: true })
@UseGuards(JwtAuthGuard, RequireSchoolModuleGuard, RequireModuleActivationGuard)
@RequireSchoolModule('outcome')
export class YillikPlanIcerikController {
  constructor(
    private readonly service: YillikPlanIcerikService,
    private readonly workCalendarService: WorkCalendarService,
    private readonly mebFetchService: MebFetchService,
  ) {}

  private readonly SON_HAFTA_37 = {
    unite: 'OKUL TEMELLİ PLANLAMA*',
    konu: 'Zümre öğretmenler kurulu kararıyla araştırma, proje, yerel çalışmalar vb.',
    kazanimlar:
      'Okul temelli planlama; zümre öğretmenler kurulu tarafından ders kapsamında gerçekleştirilmesi kararlaştırılan araştırma ve gözlem, sosyal etkinlikler, proje çalışmaları, yerel çalışmalar, okuma çalışmaları vb. çalışmaları kapsamaktadır.',
  };
  private readonly SON_HAFTA_38 = {
    unite: 'SOSYAL ETKİNLİK',
    konu: 'Yıl sonu etkinlikleri, sosyal etkinlik çalışmaları',
    kazanimlar: 'Sosyal etkinlik çalışmaları kapsamında yapılan faaliyetler.',
  };

  /** 36 hafta plan; takvim 38 ise 37-38 son hafta kuralı. Max 38, 39-40 yok. Boş 37-38'e standart içerik. */
  private fillMissingWeeks(rows: ParsedPlanRow[], targetWeeks: number): ParsedPlanRow[] {
    const maxWeeks = 38;
    const capped = Math.min(targetWeeks, maxWeeks);
    const valid = rows.filter((r) => r.week_order >= 1 && r.week_order <= maxWeeks);
    const byWeek = new Map(valid.map((r) => [r.week_order, r]));
    const result: ParsedPlanRow[] = [];
    for (let w = 1; w <= capped; w++) {
      let row = byWeek.get(w);
      if (!row) {
        const isEmpty37 = capped >= 37 && w === 37;
        const isEmpty38 = capped >= 38 && w === 38;
        row = {
          week_order: w,
          unite: isEmpty37 ? this.SON_HAFTA_37.unite : isEmpty38 ? this.SON_HAFTA_38.unite : null,
          konu: isEmpty37 ? this.SON_HAFTA_37.konu : isEmpty38 ? this.SON_HAFTA_38.konu : null,
          kazanimlar: isEmpty37 ? this.SON_HAFTA_37.kazanimlar : isEmpty38 ? this.SON_HAFTA_38.kazanimlar : null,
          ders_saati: 2,
          belirli_gun_haftalar: null,
          surec_bilesenleri: null,
          olcme_degerlendirme: null,
          sosyal_duygusal: null,
          degerler: null,
          okuryazarlik_becerileri: null,
          zenginlestirme: null,
          okul_temelli_planlama: null,
        };
      } else if (capped >= 37 && w === 37 && this.isEmptyPlanRow(row)) {
        row = {
          ...row,
          unite: this.SON_HAFTA_37.unite,
          konu: this.SON_HAFTA_37.konu,
          kazanimlar: this.SON_HAFTA_37.kazanimlar,
          ders_saati: 2,
        };
      } else if (capped >= 38 && w === 38 && this.isEmptyPlanRow(row)) {
        row = {
          ...row,
          unite: this.SON_HAFTA_38.unite,
          konu: this.SON_HAFTA_38.konu,
          kazanimlar: this.SON_HAFTA_38.kazanimlar,
          ders_saati: 2,
        };
      }
      result.push(row);
    }
    const extraWeeks = [...byWeek.keys()].filter((k) => k > capped && k <= maxWeeks).sort((a, b) => a - b);
    for (const w of extraWeeks) {
      let row = byWeek.get(w);
      if (row) {
        if (w === 37 && this.isEmptyPlanRow(row)) {
          row = {
            ...row,
            unite: this.SON_HAFTA_37.unite,
            konu: this.SON_HAFTA_37.konu,
            kazanimlar: this.SON_HAFTA_37.kazanimlar,
            ders_saati: 2,
          };
        } else if (w === 38 && this.isEmptyPlanRow(row)) {
          row = {
            ...row,
            unite: this.SON_HAFTA_38.unite,
            konu: this.SON_HAFTA_38.konu,
            kazanimlar: this.SON_HAFTA_38.kazanimlar,
            ders_saati: 2,
          };
        }
        result.push(row);
      }
    }
    return result.sort((a, b) => a.week_order - b.week_order);
  }

  private isEmptyPlanRow(r: ParsedPlanRow): boolean {
    const u = (r.unite ?? '').trim();
    const k = (r.konu ?? '').trim();
    return !u || u === '—' || !k || k === '—';
  }

  private sanitizeImportedRows(rows: ParsedPlanRow[]): ParsedPlanRow[] {
    const weekLabelRegex = /^\s*\d{1,2}\.\s*hafta\b/i;
    return rows
      .map((r) => {
        const unite = (r.unite ?? '').trim();
        const konu = (r.konu ?? '').trim();
        const okulTemelli = (r.okul_temelli_planlama ?? '').trim();
        return {
          ...r,
          unite: weekLabelRegex.test(unite) ? null : (unite || null),
          konu: weekLabelRegex.test(konu) ? null : (konu || null),
          okul_temelli_planlama: this.looksLikeLongOkulTemelliNote(okulTemelli) ? null : (okulTemelli || null),
        };
      })
      .sort((a, b) => a.week_order - b.week_order);
  }

  private looksLikeLongOkulTemelliNote(text: string): boolean {
    const t = text.toLowerCase();
    if (!t) return false;
    return (
      t.includes('zümre öğretmenler kurulu tarafından') ||
      t.includes('okul dışı öğrenme etkinlikleri') ||
      t.includes('planlama, zümre öğretmenler kurulunda')
    );
  }

  private isPlaceholderText(v?: string | null): boolean {
    const s = (v ?? '').trim();
    return !s || s === '—';
  }

  private isSpecialWeekRow(r: ParsedPlanRow): boolean {
    const blob = `${r.unite ?? ''} ${r.konu ?? ''} ${r.kazanimlar ?? ''}`.toLowerCase();
    return (
      blob.includes('okul temelli planlama') ||
      blob.includes('sosyal etkinlik') ||
      blob.includes('ara tatil') ||
      blob.includes('yarıyıl tatili') ||
      blob.includes('yariyil tatili') ||
      blob.includes('resmî tatil') ||
      blob.includes('resmi tatil')
    );
  }

  private hasCoreContent(r: ParsedPlanRow | null | undefined): boolean {
    if (!r) return false;
    const u = (r.unite ?? '').trim();
    const k = (r.konu ?? '').trim();
    const z = (r.kazanimlar ?? '').trim();
    return !this.isPlaceholderText(u) || !this.isPlaceholderText(k) || !this.isPlaceholderText(z);
  }

  /** Takvimde tatil işaretli haftalarda şablon/GPT taşmasını engelle (süreç, S-D, değer, okuryazarlık vb. boş). */
  private clearTatilSupplementaryFields(r: ParsedPlanRow): ParsedPlanRow {
    return {
      ...r,
      belirli_gun_haftalar: null,
      surec_bilesenleri: null,
      olcme_degerlendirme: null,
      sosyal_duygusal: null,
      degerler: null,
      okuryazarlik_becerileri: null,
      zenginlestirme: null,
      okul_temelli_planlama: null,
    };
  }

  private rowQualityScore(r: ParsedPlanRow | null | undefined): number {
    if (!r) return -100;
    let score = 0;
    const unite = (r.unite ?? '').trim();
    const konu = (r.konu ?? '').trim();
    const kazanim = (r.kazanimlar ?? '').trim();
    const all = `${unite} ${konu} ${kazanim}`.toLowerCase();
    if (!this.isPlaceholderText(unite)) score += 2;
    if (!this.isPlaceholderText(konu)) score += 2;
    if (!this.isPlaceholderText(kazanim)) score += 1;
    if (/^\s*\d{1,2}\.\s*hafta\b/i.test(unite)) score -= 3;
    if (/^\s*\d{1,2}\.\s*hafta\b/i.test(konu)) score -= 3;
    if (this.looksLikeLongOkulTemelliNote((r.okul_temelli_planlama ?? '').trim())) score -= 2;
    if (all.includes('dinleyeceklerini/izleyeceklerini amacına uygun olarak seçer') && this.isPlaceholderText(unite)) score -= 2;
    return score;
  }

  private mergeParseAndGptRows(parseRows: ParsedPlanRow[], gptRows: ParsedPlanRow[]): ParsedPlanRow[] {
    const parseByWeek = new Map(parseRows.map((r) => [r.week_order, r]));
    const gptByWeek = new Map(gptRows.map((r) => [r.week_order, r]));
    const weeks = [...new Set([...parseByWeek.keys(), ...gptByWeek.keys()])].sort((a, b) => a - b);
    const merged: ParsedPlanRow[] = [];
    for (const week of weeks) {
      const p = parseByWeek.get(week);
      const g = gptByWeek.get(week);
      const chosen = this.rowQualityScore(g) > this.rowQualityScore(p) ? g : p;
      if (chosen) merged.push(chosen);
    }
    return merged;
  }

  private hydrateEmptyWeeks(
    rows: ParsedPlanRow[],
    gptRows: ParsedPlanRow[],
    subjectCode: string,
    grade: number,
    tatilWeeks: Set<number>,
  ): ParsedPlanRow[] {
    const expectedHour = getDersSaatiStatic(subjectCode, grade);
    const byWeek = new Map(rows.map((r) => [r.week_order, { ...r }]));
    const gptByWeek = new Map(gptRows.map((r) => [r.week_order, r]));
    const weeks = [...byWeek.keys()].sort((a, b) => a - b);
    let lastNonEmpty: ParsedPlanRow | null = null;

    for (const w of weeks) {
      const row = byWeek.get(w);
      if (!row) continue;
      if (this.hasCoreContent(row)) {
        lastNonEmpty = row;
        continue;
      }
      if (w >= 37 || tatilWeeks.has(w)) continue;

      const gptCandidate = gptByWeek.get(w);
      if (this.hasCoreContent(gptCandidate)) {
        byWeek.set(w, {
          ...row,
          unite: gptCandidate?.unite ?? row.unite,
          konu: gptCandidate?.konu ?? row.konu,
          kazanimlar: gptCandidate?.kazanimlar ?? row.kazanimlar,
          surec_bilesenleri: gptCandidate?.surec_bilesenleri ?? row.surec_bilesenleri,
          olcme_degerlendirme: gptCandidate?.olcme_degerlendirme ?? row.olcme_degerlendirme,
          sosyal_duygusal: gptCandidate?.sosyal_duygusal ?? row.sosyal_duygusal,
          degerler: gptCandidate?.degerler ?? row.degerler,
          okuryazarlik_becerileri: gptCandidate?.okuryazarlik_becerileri ?? row.okuryazarlik_becerileri,
          ders_saati: expectedHour,
        });
        lastNonEmpty = byWeek.get(w) ?? lastNonEmpty;
        continue;
      }

      if (lastNonEmpty) {
        byWeek.set(w, {
          ...row,
          unite: lastNonEmpty.unite ?? row.unite,
          konu: lastNonEmpty.konu ?? row.konu,
          kazanimlar: lastNonEmpty.kazanimlar ?? row.kazanimlar,
          ders_saati: expectedHour,
        });
      }
    }

    return [...byWeek.values()].sort((a, b) => a.week_order - b.week_order);
  }

  private strictValidatePlanRows(
    candidateRows: ParsedPlanRow[],
    fallbackRows: ParsedPlanRow[],
    targetWeeks: number,
    tatilWeeks: Set<number>,
    subjectCode: string,
    grade: number,
  ): ParsedPlanRow[] {
    const capped = Math.min(Math.max(targetWeeks, 1), 38);
    const expectedHour = getDersSaatiStatic(subjectCode, grade);
    const cMap = new Map(candidateRows.map((r) => [r.week_order, r]));
    const fMap = new Map(fallbackRows.map((r) => [r.week_order, r]));
    const out: ParsedPlanRow[] = [];
    let lastNonEmpty: ParsedPlanRow | null = null;

    for (let w = 1; w <= capped; w++) {
      let row = cMap.get(w) ?? fMap.get(w) ?? null;
      if (!row) {
        row = {
          week_order: w,
          unite: null,
          konu: null,
          kazanimlar: null,
          ders_saati: expectedHour,
          belirli_gun_haftalar: null,
          surec_bilesenleri: null,
          olcme_degerlendirme: null,
          sosyal_duygusal: null,
          degerler: null,
          okuryazarlik_becerileri: null,
          zenginlestirme: null,
          okul_temelli_planlama: null,
        };
      }

      const isTatil = tatilWeeks.has(w);
      if (!isTatil && w === 37) {
        row = { ...row, unite: this.SON_HAFTA_37.unite, konu: this.SON_HAFTA_37.konu, kazanimlar: this.SON_HAFTA_37.kazanimlar, ders_saati: 2 };
      } else if (!isTatil && w === 38) {
        row = { ...row, unite: this.SON_HAFTA_38.unite, konu: this.SON_HAFTA_38.konu, kazanimlar: this.SON_HAFTA_38.kazanimlar, ders_saati: 2 };
      } else {
        const coreEmpty = !this.hasCoreContent(row);
        if (!isTatil && coreEmpty) {
          const fb = fMap.get(w);
          if (this.hasCoreContent(fb)) {
            row = { ...row, ...fb, week_order: w };
          } else if (lastNonEmpty) {
            row = {
              ...row,
              unite: lastNonEmpty.unite,
              konu: lastNonEmpty.konu,
              kazanimlar: lastNonEmpty.kazanimlar,
            };
          }
        }
        const raw: number = Number(row.ders_saati);
        const validRaw: number | null =
          Number.isFinite(raw) && raw >= 0 && raw <= 10 ? Math.round(raw) : null;
        row = { ...row, ders_saati: isTatil ? 2 : validRaw == null ? expectedHour : validRaw };
      }

      if (isTatil) {
        row = this.clearTatilSupplementaryFields(row);
      }
      if (this.looksLikeLongOkulTemelliNote((row.okul_temelli_planlama ?? '').trim())) {
        row = { ...row, okul_temelli_planlama: null };
      }
      if (this.hasCoreContent(row)) lastNonEmpty = row;
      out.push(row);
    }
    return out.sort((a, b) => a.week_order - b.week_order);
  }

  private normalizeImportedHours(rows: ParsedPlanRow[], subjectCode: string, grade: number): ParsedPlanRow[] {
    const expected = getDersSaatiStatic(subjectCode, grade);
    return rows.map((r) => {
      const raw = Number(r.ders_saati);
      const validRaw = Number.isFinite(raw) && raw >= 0 && raw <= 10 ? Math.round(raw) : null;
      const isSpecial = r.week_order >= 37 || this.isSpecialWeekRow(r) || this.isEmptyPlanRow(r);
      const normalized = isSpecial ? 2 : validRaw == null || validRaw === 2 ? expected : validRaw;
      return { ...r, ders_saati: normalized };
    });
  }

  private looksLikeThemeText(text: string): boolean {
    const t = text.toLowerCase();
    return (
      t.includes('tema') ||
      t.includes('pekiştirme haftası') ||
      t.includes('pekistirme haftasi') ||
      t.includes('hatırlatma haftası') ||
      t.includes('hatirlatma haftasi')
    );
  }

  private looksLikeLearningOutcomeText(text: string): boolean {
    const t = text.toLowerCase();
    return (
      t.includes('dinleyeceklerini/izleyeceklerini') ||
      t.includes('dinleme kurallarına uygun') ||
      t.includes('dinleme kurallarina uygun') ||
      t.includes('konuşmaya dâhil olmak') ||
      t.includes('konusmaya dahil olmak') ||
      t.includes('harf ve heceleri doğru')
    );
  }

  private repairMisalignedRows(rows: ParsedPlanRow[]): ParsedPlanRow[] {
    let lastValidKonu: string | null = null;
    return rows.map((r) => {
      const unite = (r.unite ?? '').trim();
      const konu = (r.konu ?? '').trim();
      const kazanim = (r.kazanimlar ?? '').trim();
      const hasMissingUnite = this.isPlaceholderText(unite);
      const hasThemeInKazanim = this.looksLikeThemeText(kazanim);
      const konuLooksLikeOutcome = this.looksLikeLearningOutcomeText(konu);

      let fixed = { ...r };
      if (hasMissingUnite && hasThemeInKazanim) {
        const lines = kazanim
          .split('\n')
          .map((x) => x.trim())
          .filter(Boolean);
        const themeLine = lines.find((x) => this.looksLikeThemeText(x)) ?? lines[0] ?? null;
        const remaining = lines.filter((x) => x !== themeLine).join(' ').trim();
        if (themeLine) fixed.unite = themeLine;
        if (konuLooksLikeOutcome) {
          fixed.konu = (lastValidKonu ?? 'DİNLEME');
          fixed.kazanimlar = remaining || konu || fixed.kazanimlar;
        } else if (remaining) {
          fixed.kazanimlar = remaining;
        }
      }

      const candidateKonu = (fixed.konu ?? '').trim();
      if (!this.isPlaceholderText(candidateKonu) && !this.looksLikeLearningOutcomeText(candidateKonu)) {
        lastValidKonu = candidateKonu;
      }
      return fixed;
    });
  }

  /** Takvim 38 hafta ise 38 (son iki hafta kuralı); else 36. Max 38. */
  private async getTargetWeeksForYear(academicYear: string): Promise<number> {
    const calendar = await this.workCalendarService.findAll(academicYear);
    const teaching = calendar.filter((w) => w.weekOrder >= 1 && w.weekOrder <= 38);
    if (teaching.length > 0) {
      const max = Math.max(...teaching.map((w) => w.weekOrder));
      return Math.min(max, 38);
    }
    if (hasMebCalendar(academicYear)) {
      const meb = generateMebWorkCalendar(academicYear);
      const max = Math.max(0, ...meb.filter((w) => w.week_order >= 1).map((w) => w.week_order));
      return Math.min(max || 36, 38);
    }
    return 36;
  }

  /** Plan meta (tablo altı not) – ders/sınıf/yıl filtreleri zorunlu */
  @Get('meta')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin, UserRole.moderator)
  @RequireModule('document_templates')
  async getMeta(
    @Query('subject_code') subjectCode?: string,
    @Query('grade') grade?: string,
    @Query('ana_grup') anaGrup?: string,
    @Query('alt_grup') altGrup?: string,
    @Query('academic_year') academicYear?: string,
    @Query('curriculum_model') curriculumModel?: string,
  ) {
    if (!subjectCode?.trim() || !academicYear?.trim()) return { tablo_alti_not: null };
    const cm = curriculumModel?.trim() || null;
    if (cm === 'bilsem') {
      if (!anaGrup?.trim()) return { tablo_alti_not: null };
      const tabloAltiNot = await this.service.getMeta(
        subjectCode.trim(),
        anaGrup.trim(),
        academicYear.trim(),
        cm,
        altGrup?.trim() || null,
      );
      return { tablo_alti_not: tabloAltiNot };
    }
    if (!grade?.trim()) return { tablo_alti_not: null };
    const n = parseInt(grade, 10);
    if (!Number.isFinite(n) || n < 1 || n > 12) return { tablo_alti_not: null };
    const tabloAltiNot = await this.service.getMeta(subjectCode.trim(), n, academicYear.trim());
    return { tablo_alti_not: tabloAltiNot };
  }

  /** Plan meta güncelle (tablo altı not) */
  @Patch('meta')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin, UserRole.moderator)
  @RequireModule('document_templates')
  async updateMeta(
    @Body()
    body: {
      subject_code: string;
      grade?: number;
      ana_grup?: string;
      alt_grup?: string;
      academic_year: string;
      tablo_alti_not?: string | null;
      curriculum_model?: string | null;
    },
  ) {
    const { subject_code, grade, ana_grup, alt_grup, academic_year, tablo_alti_not, curriculum_model } = body;
    if (!subject_code?.trim() || !academic_year?.trim()) {
      throw new BadRequestException({
        code: 'META_PARAMS_REQUIRED',
        message: 'subject_code ve academic_year zorunludur.',
      });
    }
    const cm = curriculum_model?.trim() || null;
    if (cm === 'bilsem') {
      if (!ana_grup?.trim()) {
        throw new BadRequestException({
          code: 'ANA_GRUP_REQUIRED',
          message: 'Bilsem için ana_grup zorunludur.',
        });
      }
      await this.service.upsertMeta(
        subject_code.trim(),
        ana_grup.trim(),
        academic_year.trim(),
        tablo_alti_not ?? null,
        cm,
        alt_grup?.trim() || null,
      );
    } else {
      if (grade == null || !Number.isFinite(Number(grade)) || Number(grade) < 1 || Number(grade) > 12) {
        throw new BadRequestException({
          code: 'INVALID_GRADE',
          message: 'grade 1-12 arası olmalıdır.',
        });
      }
      await this.service.upsertMeta(subject_code.trim(), Number(grade), academic_year.trim(), tablo_alti_not ?? null);
    }
    return { ok: true };
  }

  /** Superadmin, moderator: Listele (ders/sınıf/yıl filtreleri). Hafta etiketi work_calendar'dan eklenir. */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin, UserRole.moderator)
  @RequireModule('document_templates')
  async list(
    @Query('subject_code') subjectCode?: string,
    @Query('grade') grade?: string,
    @Query('ana_grup') anaGrup?: string,
    @Query('alt_grup') altGrup?: string,
    @Query('academic_year') academicYear?: string,
    @Query('curriculum_model') curriculumModel?: string,
  ) {
    const cm = curriculumModel?.trim() || undefined;
    const items = await this.service.findAll({
      subject_code: subjectCode,
      grade: cm !== 'bilsem' && grade ? parseInt(grade, 10) : undefined,
      ana_grup: cm === 'bilsem' ? anaGrup : undefined,
      alt_grup: cm === 'bilsem' ? altGrup : undefined,
      academic_year: academicYear,
      curriculum_model: cm,
    });
    if (cm === 'bilsem') this.service.attachBilsemPuyDisplayDefaults(items);
    const academicYears = [...new Set(items.map((i) => i.academicYear))];
    const weekLabelMap = new Map<string, string>();
    const weekAyMap = new Map<string, string>();
    for (const y of academicYears) {
      const calendar = await this.workCalendarService.findAll(y);
      for (const w of calendar) {
        const k = `${y}:${w.weekOrder}`;
        if (w.haftaLabel) weekLabelMap.set(k, w.haftaLabel);
        if (w.ay) weekAyMap.set(k, w.ay);
      }
    }
    const enriched = items.map((i) => {
      const plain = { ...i };
      const key = `${i.academicYear}:${i.weekOrder}`;
      const haftaLabel = weekLabelMap.get(key) ?? `${i.weekOrder}. Hafta`;
      (plain as Record<string, unknown>).hafta_label = haftaLabel;
      (plain as Record<string, unknown>).ay = resolveAyForYillikPlanRow({
        haftaLabel,
        calendarAy: weekAyMap.get(key),
        weekOrder: i.weekOrder,
        academicYear: i.academicYear,
      });
      return plain;
    });
    return { items: enriched };
  }

  /** Hangi derse plan hazır – özet liste (ders, sınıf, yıl, hafta sayısı) */
  @Get('summary')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin, UserRole.moderator)
  @RequireModule('document_templates')
  async summary(@Query('curriculum_model') curriculumModel?: string) {
    const rows = await this.service.findSummary(curriculumModel?.trim() || null);
    return { items: rows };
  }

  /** MEB taslak planı desteklenen ders listesi. grade=1-8 Temel Eğitim, 9-12 Ortaöğretim. */
  @Get('meb/subjects')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin, UserRole.moderator)
  @RequireModule('document_templates')
  async mebSubjects(@Query('grade') grade?: string) {
    const gradeNum = grade ? parseInt(grade, 10) : undefined;
    const codes = this.mebFetchService.getAvailableSubjects(
      Number.isFinite(gradeNum) ? gradeNum : undefined
    );
    return {
      subjects: codes.map((code) => ({
        code,
        label: this.mebFetchService.getSubjectLabel(code),
      })),
    };
  }

  /** Teacher, superadmin, moderator: Kazanım / Plan – mevcut planlar listesi. ?q= ile plan içeriğinde arama. */
  @Get('teacher/plans')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  async teacherPlans(@Query('q') contentSearch?: string) {
    const q = contentSearch?.trim();
    if (q && q.length >= 2) {
      const withMatches = await this.service.findPlansWithMatchesRaw(q);
      return {
        items: withMatches.map((r) => ({
          id: `${r.subject_code}:${r.grade}:${r.academic_year}:${r.section ?? ''}`,
          subject_code: r.subject_code,
          subject_label: r.subject_label,
          grade: r.grade,
          academic_year: r.academic_year,
          section: r.section ?? null,
          week_count: r.week_count,
          matches: r.matches,
        })),
      };
    }
    const rows = await this.service.findSummary();
    return {
      items: rows.map((r) => ({
        id: `${r.subject_code}:${r.grade}:${r.academic_year}:${r.section ?? ''}`,
        subject_code: r.subject_code,
        subject_label: r.subject_label,
        grade: r.grade,
        academic_year: r.academic_year,
        section: r.section ?? null,
        week_count: r.week_count,
      })),
    };
  }

  /** Teacher, superadmin, moderator: Kazanım / Plan – içerik (yillik_plan_icerik + work_calendar hafta etiketleri) */
  @Get('teacher/plan-content')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  async teacherPlanContent(
    @Query('subject_code') subjectCode?: string,
    @Query('grade') grade?: string,
    @Query('academic_year') academicYear?: string,
    @Query('section') section?: string,
  ) {
    if (!subjectCode?.trim() || !grade?.trim() || !academicYear?.trim()) {
      throw new BadRequestException({
        code: 'PARAMS_REQUIRED',
        message: 'subject_code, grade ve academic_year zorunludur.',
      });
    }
    const gradeNum = parseInt(grade.trim(), 10);
    if (!Number.isFinite(gradeNum) || gradeNum < 1 || gradeNum > 12) {
      throw new BadRequestException({
        code: 'INVALID_GRADE',
        message: 'grade 1-12 arası olmalıdır.',
      });
    }
    const filtered = await this.service.findAll({
      subject_code: subjectCode.trim(),
      grade: gradeNum,
      academic_year: academicYear.trim(),
      section: section?.trim() ? section.trim() : null,
      curriculum_model: null,
    });
    const weekLabelMap = new Map<string, string>();
    const weekAyMap = new Map<string, string>();
    const weekRangeMap = new Map<string, { week_start: string; week_end: string }>();
    const calendar = await this.workCalendarService.findAll(academicYear.trim());
    for (const w of calendar) {
      const k = `${academicYear.trim()}:${w.weekOrder}`;
      if (w.haftaLabel) weekLabelMap.set(k, w.haftaLabel);
      if (w.ay) weekAyMap.set(k, w.ay);
      weekRangeMap.set(k, { week_start: w.weekStart, week_end: w.weekEnd });
    }
    const enriched = filtered.map((i) => {
      const key = `${i.academicYear}:${i.weekOrder}`;
      const range = weekRangeMap.get(key);
      const haftaLabel = weekLabelMap.get(key) ?? `${i.weekOrder}. Hafta`;
      const ay = resolveAyForYillikPlanRow({
        haftaLabel,
        calendarAy: weekAyMap.get(key),
        weekOrder: i.weekOrder,
        academicYear: i.academicYear,
      });
      return {
        ...i,
        hafta_label: haftaLabel,
        ay,
        week_start: range?.week_start ?? null,
        week_end: range?.week_end ?? null,
      };
    });
    return {
      subject_code: subjectCode.trim(),
      subject_label: filtered[0]?.subjectLabel ?? subjectCode.trim(),
      grade: gradeNum,
      academic_year: academicYear.trim(),
      section: section?.trim() || null,
      items: enriched,
    };
  }

  /** Superadmin, moderator: Tek kayıt */
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin, UserRole.moderator)
  @RequireModule('document_templates')
  async getOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  /** Superadmin, moderator: Yeni kayıt */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin, UserRole.moderator)
  @RequireModule('document_templates')
  async create(@Body() dto: CreateYillikPlanIcerikDto) {
    return this.service.create(dto);
  }

  /** Superadmin, moderator: Güncelle */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin, UserRole.moderator)
  @RequireModule('document_templates')
  async update(@Param('id') id: string, @Body() dto: UpdateYillikPlanIcerikDto) {
    return this.service.update(id, dto);
  }

  /** Superadmin, moderator: Sil */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin, UserRole.moderator)
  @RequireModule('document_templates')
  async remove(@Param('id') id: string) {
    await this.service.remove(id);
    return { success: true };
  }

  /** Superadmin, moderator: Toplu silme (filtrelere uyan tüm plan satırları silinir) */
  @Post('bulk-delete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin, UserRole.moderator)
  @RequireModule('document_templates')
  async bulkDelete(
    @Body()
    body: {
      subject_code: string;
      grade?: number;
      ana_grup?: string;
      alt_grup?: string;
      academic_year: string;
      curriculum_model?: string | null;
    },
  ) {
    const count = await this.service.bulkDelete(body);
    return { deleted: count, success: true };
  }
}
