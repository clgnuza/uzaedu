import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ExtraLessonParams,
  ExtraLessonLineItem,
  EducationLevel,
} from './entities/extra-lesson-params.entity';
import { ExtraLessonLineItemTemplate } from './entities/extra-lesson-line-item-template.entity';
import { CreateExtraLessonParamsDto } from './dto/create-extra-lesson-params.dto';
import { UpdateExtraLessonParamsDto } from './dto/update-extra-lesson-params.dto';
import { ListExtraLessonParamsDto } from './dto/list-extra-lesson-params.dto';
import { AYLIK_KATSAYI_2026_OCAK_HAZIRAN } from './resmi-katsayilar';

/** MEB 2026 resmi değerleri – GV Seri 332, DV istisna, SGK/ücretli parametreleri */
const RESMI_2026 = {
  gv_exemption_max: 4211.33,
  dv_exemption_max: 33030,
  stamp_duty_rate: 7.59,
  /** Sözleşmeli/Ücretli: SGK+İşsizlik işçi payı %14 (5510 sayılı Kanun) */
  sgk_employee_rate: 14,
  /** Ücretli birim ücret oranı. 1 = kadrolu ile aynı brüt; 0.725 = MEB %72,5 tarifesi. */
  ucretli_unit_scale: 1,
  tax_brackets: [
    { max_matrah: 190000, rate_percent: 15 },
    { max_matrah: 400000, rate_percent: 20 },
    { max_matrah: 1500000, rate_percent: 27 },
    { max_matrah: 5300000, rate_percent: 35 },
    { max_matrah: Number.MAX_SAFE_INTEGER, rate_percent: 40 },
  ] as { max_matrah: number; rate_percent: number }[],
};

type TemplateRow = {
  key: string;
  label: string;
  type: 'hourly' | 'fixed';
  indicator_day: number;
  indicator_night: number | null;
  sort_order: number;
};

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 dakika
type CacheEntry<T> = { data: T; ts: number };

@Injectable()
export class ExtraLessonParamsService {
  private paramsCache = new Map<string, CacheEntry<ExtraLessonParams | null>>();
  private semestersCache: CacheEntry<{ semester_code: string; title: string }[]> | null = null;

  private invalidateReadCache(): void {
    this.paramsCache.clear();
    this.semestersCache = null;
  }
  constructor(
    @InjectRepository(ExtraLessonParams)
    private readonly repo: Repository<ExtraLessonParams>,
    @InjectRepository(ExtraLessonLineItemTemplate)
    private readonly templateRepo: Repository<ExtraLessonLineItemTemplate>,
  ) {}

  async create(dto: CreateExtraLessonParamsDto): Promise<ExtraLessonParams> {
    const coeff = dto.monthly_coefficient ?? parseFloat(AYLIK_KATSAYI_2026_OCAK_HAZIRAN);
    const indDay = dto.indicator_day ?? 140;
    const indNight = dto.indicator_night ?? 150;
    const templateRows = await this.getLineItemTemplates();
    const baseItems = templateRows.map((t) => ({ key: t.key, label: t.label, type: t.type, sort_order: t.sort_order }));
    const lineItems = dto.line_items
      ? this.resolveLineItems(dto.line_items, coeff, indDay, indNight)
      : this.resolveLineItemsFromTemplates(baseItems, templateRows, coeff);
    const entity = this.repo.create({
      semester_code: dto.semester_code,
      title: dto.title,
      monthly_coefficient: coeff ? String(coeff) : null,
      indicator_day: indDay,
      indicator_night: indNight,
      line_items: lineItems,
      tax_brackets: dto.tax_brackets ?? RESMI_2026.tax_brackets,
      gv_exemption_max: String(dto.gv_exemption_max ?? RESMI_2026.gv_exemption_max),
      dv_exemption_max: String(dto.dv_exemption_max ?? RESMI_2026.dv_exemption_max),
      stamp_duty_rate: String(dto.stamp_duty_rate ?? RESMI_2026.stamp_duty_rate),
      sgk_employee_rate: dto.sgk_employee_rate != null ? String(dto.sgk_employee_rate) : String(RESMI_2026.sgk_employee_rate),
      ucretli_unit_scale: dto.ucretli_unit_scale != null ? String(dto.ucretli_unit_scale) : String(RESMI_2026.ucretli_unit_scale),
      central_exam_roles: dto.central_exam_roles ?? this.getDefaultCentralExamRoles(),
      education_levels:
        dto.education_levels && dto.education_levels.length > 0
          ? dto.education_levels
          : this.getDefaultEducationLevels(),
      is_active: dto.is_active ?? true,
      valid_from: dto.valid_from ? new Date(dto.valid_from) : null,
      valid_to: dto.valid_to ? new Date(dto.valid_to) : null,
    });
    const saved = await this.repo.save(entity);
    this.invalidateReadCache();
    return saved;
  }

  async findAll(dto: ListExtraLessonParamsDto): Promise<ExtraLessonParams[]> {
    const qb = this.repo.createQueryBuilder('p').orderBy('p.semester_code', 'DESC');
    if (dto.is_active !== undefined) {
      qb.andWhere('p.is_active = :isActive', { isActive: dto.is_active });
    }
    if (dto.semester_code) {
      qb.andWhere('p.semester_code = :code', { code: dto.semester_code });
    }
    return qb.getMany();
  }

  async findOne(id: string): Promise<ExtraLessonParams> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException('Parametre seti bulunamadı');
    }
    return entity;
  }

  async findBySemesterCode(semesterCode: string): Promise<ExtraLessonParams | null> {
    return this.repo.findOne({
      where: { semester_code: semesterCode, is_active: true },
    });
  }

  /** Hesaplama sayfası için: superadmin'in girdiği aktif bütçe dönemlerinin listesi */
  async findAvailableSemesters(): Promise<{ semester_code: string; title: string }[]> {
    const now = Date.now();
    if (this.semestersCache && now - this.semestersCache.ts < CACHE_TTL_MS) {
      return this.semestersCache.data;
    }
    const all = await this.repo.find({
      where: { is_active: true },
      select: ['semester_code', 'title'],
      order: { semester_code: 'DESC' },
    });
    const data = all.map((p) => ({ semester_code: p.semester_code, title: p.title }));
    this.semestersCache = { data, ts: now };
    return data;
  }

  /** Teacher için: aktif parametre seti (en son dönem veya belirtilen kod) */
  async getActiveParams(semesterCode?: string): Promise<ExtraLessonParams | null> {
    const key = semesterCode ?? '__default__';
    const now = Date.now();
    const cached = this.paramsCache.get(key);
    if (cached && now - cached.ts < CACHE_TTL_MS) {
      return cached.data;
    }
    let result: ExtraLessonParams | null;
    if (semesterCode) {
      result = await this.findBySemesterCode(semesterCode);
    } else {
      const [latest] = await this.repo.find({
        where: { is_active: true },
        order: { semester_code: 'DESC' },
        take: 1,
      });
      result = latest ?? null;
    }
    this.paramsCache.set(key, { data: result, ts: now });
    return result;
  }

  async update(id: string, dto: UpdateExtraLessonParamsDto): Promise<ExtraLessonParams> {
    const entity = await this.findOne(id);
    if (dto.semester_code !== undefined) entity.semester_code = dto.semester_code;
    if (dto.title !== undefined) entity.title = dto.title;
    if (dto.monthly_coefficient !== undefined) entity.monthly_coefficient = String(dto.monthly_coefficient);
    if (dto.indicator_day !== undefined) entity.indicator_day = dto.indicator_day;
    if (dto.indicator_night !== undefined) entity.indicator_night = dto.indicator_night;

    const coeffOrIndicatorsChanged =
      dto.monthly_coefficient !== undefined ||
      dto.indicator_day !== undefined ||
      dto.indicator_night !== undefined;

    const coeff = parseFloat(entity.monthly_coefficient || AYLIK_KATSAYI_2026_OCAK_HAZIRAN);
    const indDay = entity.indicator_day ?? 140;
    const indNight = entity.indicator_night ?? 150;

    if (coeffOrIndicatorsChanged) {
      const templateRows = await this.getLineItemTemplates();
      const baseItems = templateRows.map((t) => ({ key: t.key, label: t.label, type: t.type, sort_order: t.sort_order }));
      entity.line_items = this.resolveLineItemsFromTemplates(baseItems, templateRows, coeff);
      if (dto.central_exam_roles === undefined) {
        entity.central_exam_roles = this.getDefaultCentralExamRoles();
      }
    } else if (dto.line_items !== undefined) {
      entity.line_items = this.resolveLineItems(dto.line_items, coeff, indDay, indNight);
    }

    if (dto.central_exam_roles !== undefined) entity.central_exam_roles = dto.central_exam_roles;
    if (dto.education_levels !== undefined && dto.education_levels.length > 0) {
      entity.education_levels = dto.education_levels;
    }
    if (dto.tax_brackets !== undefined) entity.tax_brackets = dto.tax_brackets;
    if (dto.gv_exemption_max !== undefined) entity.gv_exemption_max = String(dto.gv_exemption_max);
    if (dto.dv_exemption_max !== undefined) entity.dv_exemption_max = String(dto.dv_exemption_max);
    if (dto.stamp_duty_rate !== undefined) entity.stamp_duty_rate = String(dto.stamp_duty_rate);
    if (dto.sgk_employee_rate !== undefined) entity.sgk_employee_rate = String(dto.sgk_employee_rate);
    if (dto.ucretli_unit_scale !== undefined) entity.ucretli_unit_scale = String(dto.ucretli_unit_scale);
    if (dto.is_active !== undefined) entity.is_active = dto.is_active;
    if (dto.valid_from !== undefined) entity.valid_from = dto.valid_from ? new Date(dto.valid_from) : null;
    if (dto.valid_to !== undefined) entity.valid_to = dto.valid_to ? new Date(dto.valid_to) : null;
    const saved = await this.repo.save(entity);
    this.invalidateReadCache();
    return saved;
  }

  async remove(id: string): Promise<void> {
    const entity = await this.findOne(id);
    await this.repo.remove(entity);
    this.invalidateReadCache();
  }

  /**
   * Gösterge tablosu kalemleri. Boşsa varsayılan değerlerle doldurulur.
   */
  async getLineItemTemplates(): Promise<TemplateRow[]> {
    await this.seedLineItemTemplatesIfEmpty();
    const rows = await this.templateRepo.find({
      order: { sort_order: 'ASC', key: 'ASC' },
    });
    return rows.map((r) => ({
      key: r.key,
      label: r.label,
      type: r.type as 'hourly' | 'fixed',
      indicator_day: Number(r.indicator_day),
      indicator_night: r.indicator_night != null ? Number(r.indicator_night) : null,
      sort_order: r.sort_order,
    }));
  }

  /**
   * Gösterge tablosunu güncelle. Superadmin/moderator.
   */
  async updateLineItemTemplates(
    templates: { key: string; label: string; type: 'hourly' | 'fixed'; indicator_day: number; indicator_night?: number | null; sort_order: number }[],
  ): Promise<TemplateRow[]> {
    const existing = await this.templateRepo.find();
    const byKey = new Map(existing.map((e) => [e.key, e]));
    for (const t of templates) {
      let ent = byKey.get(t.key);
      if (!ent) {
        ent = this.templateRepo.create({
          key: t.key,
          label: t.label,
          type: t.type,
          indicator_day: t.indicator_day,
          indicator_night: t.indicator_night ?? undefined,
          sort_order: t.sort_order,
        } as Partial<ExtraLessonLineItemTemplate>);
        await this.templateRepo.save(ent);
      } else {
        ent.label = t.label;
        ent.type = t.type;
        ent.indicator_day = t.indicator_day;
        ent.indicator_night = t.indicator_night ?? null;
        ent.sort_order = t.sort_order;
        await this.templateRepo.save(ent);
      }
    }
    return this.getLineItemTemplates();
  }

  private async seedLineItemTemplatesIfEmpty(): Promise<void> {
    const defaults: TemplateRow[] = [
      { key: 'gunduz', label: 'Gündüz', type: 'hourly', indicator_day: 140, indicator_night: 150, sort_order: 1 },
      { key: 'gece', label: 'Gece', type: 'hourly', indicator_day: 150, indicator_night: null, sort_order: 2 },
      { key: 'nobet', label: 'Nöbet Görevi', type: 'hourly', indicator_day: 140, indicator_night: null, sort_order: 3 },
      { key: 'belleticilik', label: 'Belleticilik', type: 'hourly', indicator_day: 140, indicator_night: null, sort_order: 4 },
      { key: 'sinav_gorevi', label: 'Sınav Görevi', type: 'hourly', indicator_day: 140, indicator_night: null, sort_order: 5 },
      { key: 'egzersiz', label: 'Egzersiz', type: 'hourly', indicator_day: 140, indicator_night: null, sort_order: 6 },
      { key: 'hizmet_ici', label: 'Hizmet İçi', type: 'hourly', indicator_day: 140, indicator_night: null, sort_order: 7 },
      { key: 'ozel_egitim_25_gunduz', label: '%25 Fazla - Gündüz (EYG Gündüz Gör.)', type: 'hourly', indicator_day: 175, indicator_night: 187.5, sort_order: 8 },
      { key: 'ozel_egitim_25_gece', label: '%25 Fazla - Gece (EYG Gece Gör.)', type: 'hourly', indicator_day: 187.5, indicator_night: null, sort_order: 9 },
      { key: 'ozel_egitim_25_nobet', label: '%25 Fazla - Nöbet (gösterge 187,5)', type: 'hourly', indicator_day: 187.5, indicator_night: null, sort_order: 10 },
      { key: 'ozel_egitim_25_belleticilik', label: '%25 Fazla - Belleticilik', type: 'hourly', indicator_day: 175, indicator_night: null, sort_order: 11 },
      { key: 'destek_odasi_25', label: 'Destek Odası %25', type: 'hourly', indicator_day: 175, indicator_night: null, sort_order: 12 },
      { key: 'evde_egitim_25', label: 'Evde Eğitim %25', type: 'hourly', indicator_day: 175, indicator_night: null, sort_order: 13 },
      { key: 'cezaevi_gunduz', label: 'Cezaevi Görevi Gündüz', type: 'hourly', indicator_day: 175, indicator_night: 187.5, sort_order: 14 },
      { key: 'cezaevi_gece', label: 'Cezaevi Görevi Gece', type: 'hourly', indicator_day: 187.5, indicator_night: null, sort_order: 15 },
      { key: 'takviye_gunduz', label: 'DYK Gündüz', type: 'hourly', indicator_day: 280, indicator_night: 300, sort_order: 16 },
      { key: 'takviye_gece', label: 'DYK Gece', type: 'hourly', indicator_day: 300, indicator_night: null, sort_order: 17 },
      { key: 'iyep_gunduz', label: 'İYEP Gündüz', type: 'hourly', indicator_day: 140, indicator_night: null, sort_order: 18 },
      { key: 'iyep_gece', label: 'İYEP Gece', type: 'hourly', indicator_day: 150, indicator_night: null, sort_order: 19 },
    ];
    const existing = await this.templateRepo.find({ select: ['key'] });
    const existingKeys = new Set(existing.map((e) => e.key));
    for (const d of defaults) {
      if (existingKeys.has(d.key)) continue;
      const ent = this.templateRepo.create({
        key: d.key,
        label: d.label,
        type: d.type,
        indicator_day: d.indicator_day,
        indicator_night: d.indicator_night ?? undefined,
        sort_order: d.sort_order,
      } as Partial<ExtraLessonLineItemTemplate>);
      await this.templateRepo.save(ent);
      existingKeys.add(d.key);
    }
  }

  /**
   * Tüm parametre setlerinin line_items ve central_exam_roles değerlerini
   * güncel Ek Ders Parametreleri tablosuna göre yeniler. Superadmin için.
   * Her set kendi katsayı/gösterge değerleriyle yeniden hesaplanır.
   */
  async refreshAllParams(): Promise<{ updated: number }> {
    const all = await this.repo.find({ order: { semester_code: 'ASC' } });
    const templateRows = await this.getLineItemTemplates();
    const baseItems = templateRows.map((t) => ({ key: t.key, label: t.label, type: t.type, sort_order: t.sort_order }));
    const defaultCentralExam = this.getDefaultCentralExamRoles();

    for (const entity of all) {
      const coeff = parseFloat(entity.monthly_coefficient || AYLIK_KATSAYI_2026_OCAK_HAZIRAN);
      entity.line_items = this.resolveLineItemsFromTemplates(baseItems, templateRows, coeff);
      entity.central_exam_roles = defaultCentralExam;
      if (!entity.education_levels?.length) {
        entity.education_levels = this.getDefaultEducationLevels();
      }
      await this.repo.save(entity);
    }
    this.invalidateReadCache();
    return { updated: all.length };
  }

  /**
   * Gösterge tablosundan (DB) gelen değerlerle unit_price hesaplar (önizleme/yönetim).
   * Brüt hesap: EDUHEP uyumu için gosterge_day/night ile saat×katsayı×gösterge tek yuvarlamada (extra-lesson-calc).
   */
  private resolveLineItemsFromTemplates(
    baseItems: { key: string; label: string; type: string; sort_order?: number }[],
    templates: TemplateRow[],
    coeff: number,
  ): ExtraLessonLineItem[] {
    const r = (v: number) => Math.round(v * 100) / 100;
    const byKey = new Map(templates.map((t) => [t.key, t]));
    const isDykKey = (k: string) => k === 'takviye_gunduz' || k === 'takviye_gece';
    return baseItems.map((item) => {
      const tpl = byKey.get(item.key);
      if (!tpl || item.type === 'fixed') {
        return { ...item, type: item.type as 'hourly' | 'fixed', sort_order: item.sort_order ?? 0 } as ExtraLessonLineItem;
      }
      const indDay = Number(tpl.indicator_day);
      const indNight = tpl.indicator_night != null ? Number(tpl.indicator_night) : null;
      const dayVal = r(coeff * indDay);
      const nightVal = indNight != null ? r(coeff * indNight) : dayVal;
      const gosterge: Partial<ExtraLessonLineItem> = !isDykKey(item.key)
        ? { gosterge_day: indDay, ...(indNight != null ? { gosterge_night: indNight } : {}) }
        : {};
      if (item.key === 'gece' || item.key.endsWith('_gece')) {
        return {
          ...item,
          type: 'hourly',
          unit_price: nightVal,
          ...gosterge,
          sort_order: item.sort_order ?? 0,
        } as ExtraLessonLineItem;
      }
      if (indNight != null && ['gunduz', 'ozel_egitim_25_gunduz', 'cezaevi_gunduz', 'takviye_gunduz'].includes(item.key)) {
        return {
          ...item,
          type: 'hourly',
          unit_price_day: dayVal,
          unit_price_night: nightVal,
          ...gosterge,
          sort_order: item.sort_order ?? 0,
        } as ExtraLessonLineItem;
      }
      return { ...item, type: 'hourly', unit_price: dayVal, ...gosterge, sort_order: item.sort_order ?? 0 } as ExtraLessonLineItem;
    });
  }

  /**
   * Formülden hesapla: Brüt = Katsayı × Gösterge × Çarpan.
   * indicator+multiplier varsa ve unit_price yoksa hesaplar; yoksa mevcut değerleri korur.
   */
  private resolveLineItems(
    items: ExtraLessonLineItem[],
    coeff: number,
    indDay: number,
    indNight: number,
  ): ExtraLessonLineItem[] {
    return items.map((item) => {
      const mult = item.multiplier ?? 1;
      const hasFormula =
        (item.indicator !== undefined || (item.multiplier !== undefined && item.multiplier !== 1)) &&
        !item.unit_price &&
        item.unit_price_day === undefined &&
        item.unit_price_night === undefined;

      if (!hasFormula || item.type === 'fixed') {
        return item;
      }

      const round = (n: number) => Math.round(n * 100) / 100;
      const dayPrice = round(coeff * indDay * mult);
      const nightPrice = round(coeff * indNight * mult);

      if (item.indicator === 150) {
        return { ...item, unit_price: nightPrice };
      }
      if (item.indicator === 140) {
        return { ...item, unit_price: dayPrice };
      }
      return {
        ...item,
        unit_price_day: dayPrice,
        unit_price_night: nightPrice,
      };
    });
  }

  private getDefaultTaxBrackets() {
    return [...RESMI_2026.tax_brackets];
  }

  /**
   * Tüm parametre setlerinin vergi alanlarını 2026 MEB resmi değerlerine günceller.
   * GV istisna max, DV istisna max, damga oranı, vergi dilimleri.
   */
  async applyResmi2026ToAll(): Promise<{ updated: number }> {
    const all = await this.repo.find({ order: { semester_code: 'ASC' } });
    for (const entity of all) {
      entity.gv_exemption_max = String(RESMI_2026.gv_exemption_max);
      entity.dv_exemption_max = String(RESMI_2026.dv_exemption_max);
      entity.stamp_duty_rate = String(RESMI_2026.stamp_duty_rate);
      entity.sgk_employee_rate = String(RESMI_2026.sgk_employee_rate);
      entity.ucretli_unit_scale = String(RESMI_2026.ucretli_unit_scale);
      entity.tax_brackets = [...RESMI_2026.tax_brackets];
      await this.repo.save(entity);
    }
    this.invalidateReadCache();
    return { updated: all.length };
  }

  /** 2026 MEB – hesaplama.net referans */
  private getDefaultEducationLevels(): EducationLevel[] {
    return [
      { key: 'lisans', label: 'Lisans', unit_day: 194.3, unit_night: 208.18 },
      { key: 'yuksek_lisans', label: 'Yüksek Lisans', unit_day: 207.9, unit_night: 222.75 },
      { key: 'doktora', label: 'Doktora', unit_day: 233.16, unit_night: 249.82 },
    ];
  }

  /**
   * 2026 Merkezi sınav rolleri. SG = Sınav Görevi tablosu.
   * Brüt = Katsayı × Gösterge. Tüm rollerde aynı formül (2026 Oca-Haz katsayı 1,387871).
   * E-Sınav: Resmi tabloda gösterge 1300, 1200 vb. (Merkezi Sınav'dan farklı).
   */
  private getDefaultCentralExamRoles() {
    return [
      // Merkezi Sınav (Açık Okul, BİLSEM, Protokol, MTSAS)
      { key: 'bina_sinav_sorumlusu', label: 'Bina Sınav Sorumlusu', indicator: 2000 },
      { key: 'komisyon_baskani', label: 'SG (Bina Yön.)', indicator: 1900 },
      { key: 'komisyon_uyesi', label: 'SG (Bin. Yön. Yrd.)', indicator: 1700 },
      { key: 'salon_baskani', label: 'SG (Salon Başk.)', indicator: 1650 },
      { key: 'gozetmen', label: 'SG (Gözetmen)', indicator: 1600 },
      { key: 'yedek_gozetmen', label: 'SG (Yed. Göz.)', indicator: 1200 },
      { key: 'yrd_engelli_gozetmen', label: 'SG (Yar.Eng.Gz.)', indicator: 2000 },
      { key: 'cezaevi_salon_baskani', label: 'SG (Cezaevi Salon Başk.)', indicator: 1650 },
      { key: 'cezaevi_gozetmen', label: 'SG (Cezaevi Gözetmen)', indicator: 1600 },
      // E-Sınav (farklı gösterge tablosu: 1300, 1200, %20 = 1560, 1440)
      { key: 'salon_baskani_esinav', label: 'E-Sınav Salon Başk.', indicator: 1300 },
      { key: 'gozetmen_esinav', label: 'E-Sınav Gözetmen', indicator: 1200 },
      { key: 'salon_baskani_esinav_20', label: 'E-Sınav Salon Başk. %20', indicator: 1560 },
      { key: 'gozetmen_esinav_20', label: 'E-Sınav Gözetmen %20', indicator: 1440 },
    ];
  }
}
