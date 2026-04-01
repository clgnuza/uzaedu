import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { YillikPlanIcerik } from './entities/yillik-plan-icerik.entity';
import { YillikPlanMeta, buildPlanKey } from './entities/yillik-plan-meta.entity';
import { CreateYillikPlanIcerikDto } from './dto/create-yillik-plan-icerik.dto';
import { UpdateYillikPlanIcerikDto } from './dto/update-yillik-plan-icerik.dto';
import { applyBilsemPuyMergeRowDefaults } from '../bilsem/bilsem-puy-plan-constants';

@Injectable()
export class YillikPlanIcerikService {
  constructor(
    @InjectRepository(YillikPlanIcerik)
    private readonly repo: Repository<YillikPlanIcerik>,
    @InjectRepository(YillikPlanMeta)
    private readonly metaRepo: Repository<YillikPlanMeta>,
  ) {}

  /** MEB / kazanım planları (curriculum_model yok) */
  private applyMebCurriculumOnly(
    qb: ReturnType<Repository<YillikPlanIcerik>['createQueryBuilder']>,
  ): void {
    qb.andWhere('(yp.curriculum_model IS NULL OR yp.curriculum_model = :empty)', { empty: '' });
  }

  private applyCurriculumFilter(
    qb: ReturnType<Repository<YillikPlanIcerik>['createQueryBuilder']>,
    curriculumModel?: string | null,
  ): void {
    if (curriculumModel?.trim() === 'bilsem') {
      qb.andWhere('yp.curriculum_model = :cm', { cm: 'bilsem' });
    } else {
      this.applyMebCurriculumOnly(qb);
    }
  }

  /** Plan içeriği olan ders kodları (grade, academic_year ile filtrelenebilir). Öğretmen evrak listesinde kullanılır. */
  async getSubjectCodesWithPlan(params?: {
    grade?: number;
    academic_year?: string;
  }): Promise<string[]> {
    const qb = this.repo
      .createQueryBuilder('yp')
      .select('DISTINCT yp.subject_code', 'subject_code');
    this.applyMebCurriculumOnly(qb);
    if (params?.grade != null && params.grade >= 1 && params.grade <= 12) {
      qb.andWhere('yp.grade = :grade', { grade: params.grade });
    }
    if (params?.academic_year?.trim()) {
      qb.andWhere('yp.academic_year = :academicYear', { academicYear: params.academic_year.trim() });
    }
    const rows = await qb.getRawMany();
    return rows.map((r) => (r as { subject_code: string }).subject_code).filter(Boolean);
  }

  /** BİLSEM: yıllık plan içeriği girilmiş ders kodları (öğretmen «plan iste» ders listesi). */
  async getSubjectCodesWithPlanBilsem(params?: {
    academic_year?: string;
    ana_grup?: string;
    alt_grup?: string;
  }): Promise<string[]> {
    const qb = this.repo
      .createQueryBuilder('yp')
      .select('DISTINCT yp.subject_code', 'subject_code');
    qb.andWhere('yp.curriculum_model = :cm', { cm: 'bilsem' });
    if (params?.academic_year?.trim()) {
      qb.andWhere('yp.academic_year = :academicYear', { academicYear: params.academic_year.trim() });
    }
    if (params?.ana_grup?.trim()) {
      qb.andWhere('yp.ana_grup = :anaGrup', { anaGrup: params.ana_grup.trim() });
    }
    if (params?.alt_grup !== undefined && params.alt_grup !== null) {
      const alt = String(params.alt_grup).trim();
      if (alt === '') {
        qb.andWhere('(yp.alt_grup IS NULL OR yp.alt_grup = :empty)', { empty: '' });
      } else {
        qb.andWhere('yp.alt_grup = :altGrup', { altGrup: alt });
      }
    }
    const rows = await qb.getRawMany();
    return rows.map((r) => (r as { subject_code: string }).subject_code).filter(Boolean);
  }

  /** Plan içeriğinde arama – eşleşen satırlarla birlikte (hafta, ünite, konu, alan, önizleme) */
  async findPlansWithMatches(q: string): Promise<
    Array<{
      subject_code: string;
      subject_label: string;
      grade: number;
      academic_year: string;
      section: string | null;
      week_count: number;
      matches: Array<{
        week_order: number;
        hafta_label: string;
        unite: string | null;
        konu: string | null;
        match_in: string;
        snippet: string;
      }>;
    }>
  > {
    const term = `%${String(q || '').trim()}%`;
    if (!term || term === '%%') return [];
    const fields: { col: string; label: string }[] = [
      { col: 'unite', label: 'Ünite/Tema' },
      { col: 'konu', label: 'Konu' },
      { col: 'kazanimlar', label: 'Kazanımlar' },
      { col: 'surec_bilesenleri', label: 'Süreç Bileşenleri' },
      { col: 'olcme_degerlendirme', label: 'Ölçme Değerlendirme' },
      { col: 'belirli_gun_haftalar', label: 'Belirli Gün/Haftalar' },
      { col: 'sosyal_duygusal', label: 'Sosyal Duygusal' },
      { col: 'degerler', label: 'Değerler' },
      { col: 'okuryazarlik_becerileri', label: 'Okuryazarlık Becerileri' },
      { col: 'zenginlestirme', label: 'Zenginleştirme' },
      { col: 'okul_temelli_planlama', label: 'Okul Temelli Planlama' },
    ];
    const colMap: Record<string, string> = {
      unite: 'unite',
      konu: 'konu',
      kazanimlar: 'kazanimlar',
      surec_bilesenleri: 'surecBilesenleri',
      olcme_degerlendirme: 'olcmeDegerlendirme',
      belirli_gun_haftalar: 'belirliGunHaftalar',
      sosyal_duygusal: 'sosyalDuygusal',
      degerler: 'degerler',
      okuryazarlik_becerileri: 'okuryazarlikBecerileri',
      zenginlestirme: 'zenginlestirme',
      okul_temelli_planlama: 'okulTemelliPlanlama',
    };
    const orClause = fields
      .map((f) => {
        const prop = colMap[f.col] ?? f.col;
        return `(yp.${prop} IS NOT NULL AND yp.${prop}::text ILIKE :term)`;
      })
      .join(' OR ');
    const items = await this.repo
      .createQueryBuilder('yp')
      .select([
        'yp.subjectCode',
        'yp.subjectLabel',
        'yp.grade',
        'yp.academicYear',
        'yp.section',
        'yp.weekOrder',
        'yp.unite',
        'yp.konu',
        'yp.kazanimlar',
        'yp.surecBilesenleri',
        'yp.olcmeDegerlendirme',
        'yp.belirliGunHaftalar',
        'yp.sosyalDuygusal',
        'yp.degerler',
        'yp.okuryazarlikBecerileri',
        'yp.zenginlestirme',
        'yp.okulTemelliPlanlama',
      ])
      .where(`(${orClause})`, { term })
      .andWhere('(yp.curriculum_model IS NULL OR yp.curriculum_model = :empty)', { empty: '' })
      .orderBy('yp.academic_year', 'DESC')
      .addOrderBy('yp.subject_label', 'ASC')
      .addOrderBy('yp.grade', 'ASC')
      .addOrderBy('yp.week_order', 'ASC')
      .getMany();
    const snippetLen = 120;
    const makeSnippet = (val: string | null): string => {
      if (!val) return '';
      const idx = val.toLowerCase().indexOf(String(q).trim().toLowerCase());
      if (idx < 0) return val.slice(0, snippetLen) + (val.length > snippetLen ? '…' : '');
      const start = Math.max(0, idx - 40);
      const end = Math.min(val.length, idx + 80);
      let s = val.slice(start, end).trim();
      if (start > 0) s = '…' + s;
      if (end < val.length) s = s + '…';
      return s;
    };
    const byPlan = new Map<string, typeof items>();
    for (const i of items) {
      const key = `${i.subjectCode}:${i.grade}:${i.academicYear}:${i.section ?? ''}`;
      if (!byPlan.has(key)) byPlan.set(key, []);
      byPlan.get(key)!.push(i);
    }
    const workCalendar = await this.repo.manager.query(
      `SELECT DISTINCT academic_year, week_order, hafta_label FROM work_calendar WHERE hafta_label IS NOT NULL`,
    );
    const weekLabelMap = new Map<string, string>();
    for (const w of workCalendar) {
      weekLabelMap.set(`${w.academic_year}:${w.week_order}`, w.hafta_label || `${w.week_order}. Hafta`);
    }
    const result: Awaited<ReturnType<YillikPlanIcerikService['findPlansWithMatches']>> = [];
    for (const [key, planItems] of byPlan) {
      const first = planItems[0]!;
      const [subject_code, gradeStr, academic_year, section = ''] = key.split(':');
      const grade = Number(gradeStr);
      const matches: (typeof result)[0]['matches'] = [];
      const seen = new Set<string>();
      for (const i of planItems) {
        const weekLabel = weekLabelMap.get(`${i.academicYear}:${i.weekOrder}`) ?? `${i.weekOrder}. Hafta`;
        for (const { col, label } of fields) {
          const prop = colMap[col] ?? col;
          const val = (i as unknown as Record<string, unknown>)[prop] as string | null;
          if (val && val.toLowerCase().includes(String(q).trim().toLowerCase())) {
            const matchKey = `${i.weekOrder}:${col}:${(val || '').slice(0, 50)}`;
            if (seen.has(matchKey)) continue;
            seen.add(matchKey);
            matches.push({
              week_order: i.weekOrder,
              hafta_label: weekLabel,
              unite: i.unite,
              konu: i.konu,
              match_in: label,
              snippet: makeSnippet(val),
            });
          }
        }
      }
      result.push({
        subject_code,
        subject_label: first.subjectLabel,
        grade,
        academic_year,
        section: section || null,
        week_count: planItems.length,
        matches: matches.slice(0, 10),
      });
    }
    return result;
  }

  /** Ham SQL ile plan içeriğinde arama – tüm metin alanlarında ILIKE */
  async findPlansWithMatchesRaw(q: string): Promise<
    Array<{
      subject_code: string;
      subject_label: string;
      grade: number;
      academic_year: string;
      section: string | null;
      week_count: number;
      matches: Array<{
        week_order: number;
        hafta_label: string;
        unite: string | null;
        konu: string | null;
        match_in: string;
        snippet: string;
      }>;
    }>
  > {
    const qTrim = String(q || '').trim();
    if (!qTrim) return [];
    const term = `%${qTrim}%`;
    const likeClause = `(unite ILIKE $1 OR konu ILIKE $1 OR kazanimlar::text ILIKE $1 OR surec_bilesenleri::text ILIKE $1 OR olcme_degerlendirme::text ILIKE $1 OR belirli_gun_haftalar ILIKE $1 OR sosyal_duygusal::text ILIKE $1 OR degerler::text ILIKE $1 OR okuryazarlik_becerileri::text ILIKE $1 OR zenginlestirme::text ILIKE $1 OR okul_temelli_planlama::text ILIKE $1)`;
    const rows = await this.repo.manager.query(
      `SELECT subject_code, subject_label, grade, academic_year, section, week_order, unite, konu, kazanimlar, surec_bilesenleri, olcme_degerlendirme, belirli_gun_haftalar, sosyal_duygusal, degerler, okuryazarlik_becerileri, zenginlestirme, okul_temelli_planlama
       FROM yillik_plan_icerik
       WHERE (${likeClause}) AND (curriculum_model IS NULL OR curriculum_model = '')
       ORDER BY academic_year DESC, subject_label ASC, grade ASC, week_order ASC`,
      [term],
    );
    const byPlan = new Map<string, typeof rows>();
    for (const r of rows) {
      const key = `${r.subject_code}:${r.grade}:${r.academic_year}:${r.section ?? ''}`;
      if (!byPlan.has(key)) byPlan.set(key, []);
      byPlan.get(key)!.push(r);
    }
    const fields: { col: string; label: string }[] = [
      { col: 'unite', label: 'Ünite/Tema' },
      { col: 'konu', label: 'Konu' },
      { col: 'kazanimlar', label: 'Kazanımlar' },
      { col: 'surec_bilesenleri', label: 'Süreç Bileşenleri' },
      { col: 'olcme_degerlendirme', label: 'Ölçme Değerlendirme' },
      { col: 'belirli_gun_haftalar', label: 'Belirli Gün/Haftalar' },
      { col: 'sosyal_duygusal', label: 'Sosyal Duygusal' },
      { col: 'degerler', label: 'Değerler' },
      { col: 'okuryazarlik_becerileri', label: 'Okuryazarlık Becerileri' },
      { col: 'zenginlestirme', label: 'Zenginleştirme' },
      { col: 'okul_temelli_planlama', label: 'Okul Temelli Planlama' },
    ];
    const qLower = qTrim.toLowerCase();
    const makeSnippet = (val: string | null): string => {
      if (!val) return '';
      const idx = val.toLowerCase().indexOf(qLower);
      if (idx < 0) return val.slice(0, 120) + (val.length > 120 ? '…' : '');
      const start = Math.max(0, idx - 40);
      const end = Math.min(val.length, idx + 80);
      let s = val.slice(start, end).trim();
      if (start > 0) s = '…' + s;
      if (end < val.length) s = s + '…';
      return s;
    };
    let weekRows: { academic_year: string; week_order: number; hafta_label: string }[] = [];
    try {
      weekRows = await this.repo.manager.query(
        `SELECT academic_year, week_order, hafta_label FROM work_calendar WHERE hafta_label IS NOT NULL`,
      );
    } catch {
      /* work_calendar yoksa hafta numarası kullan */
    }
    const weekMap = new Map<string, string>();
    for (const w of weekRows) {
      weekMap.set(`${w.academic_year}:${w.week_order}`, w.hafta_label || `${w.week_order}. Hafta`);
    }
    const result: Awaited<ReturnType<YillikPlanIcerikService['findPlansWithMatchesRaw']>> = [];
    for (const [key, planRows] of byPlan) {
      const first = planRows[0]!;
      const [subject_code, gradeStr, academic_year, section = ''] = key.split(':');
      const grade = Number(gradeStr) || 0;
      const matches: (typeof result)[0]['matches'] = [];
      const seen = new Set<string>();
      for (const r of planRows) {
        const weekLabel = weekMap.get(`${r.academic_year}:${r.week_order}`) ?? `${r.week_order}. Hafta`;
        for (const { col, label } of fields) {
          const val = r[col];
          if (val && String(val).toLowerCase().includes(qLower)) {
            const matchKey = `${r.week_order}:${col}:${String(val).slice(0, 50)}`;
            if (seen.has(matchKey)) continue;
            seen.add(matchKey);
            matches.push({
              week_order: r.week_order,
              hafta_label: weekLabel,
              unite: r.unite ?? null,
              konu: r.konu ?? null,
              match_in: label,
              snippet: makeSnippet(r[col]),
            });
          }
        }
      }
      result.push({
        subject_code,
        subject_label: first.subject_label,
        grade,
        academic_year,
        section: section || null,
        week_count: planRows.length,
        matches: matches.slice(0, 10),
      });
    }
    return result;
  }

  /** Plan içeriğinde arama – özet (ham SQL, sütun adları doğru) */
  async findSummaryWithContentSearch(q: string): Promise<
    Array<{
      subject_code: string;
      subject_label: string;
      grade: number | null;
      academic_year: string;
      section: string | null;
      week_count: number;
    }>
  > {
    const qTrim = String(q || '').trim();
    if (!qTrim) return this.findSummary(null);
    const term = `%${qTrim}%`;
    const likeClause = `(unite ILIKE $1 OR konu ILIKE $1 OR kazanimlar::text ILIKE $1 OR surec_bilesenleri::text ILIKE $1 OR olcme_degerlendirme::text ILIKE $1 OR belirli_gun_haftalar ILIKE $1 OR sosyal_duygusal::text ILIKE $1 OR degerler::text ILIKE $1 OR okuryazarlik_becerileri::text ILIKE $1 OR zenginlestirme::text ILIKE $1 OR okul_temelli_planlama::text ILIKE $1)`;
    const rows = await this.repo.manager.query(
      `SELECT subject_code, subject_label, grade, academic_year, section, COUNT(*)::int AS week_count
       FROM yillik_plan_icerik
       WHERE (${likeClause}) AND (curriculum_model IS NULL OR curriculum_model = '')
       GROUP BY subject_code, subject_label, grade, academic_year, section
       ORDER BY academic_year DESC, subject_label ASC, grade ASC`,
      [term],
    );
    return rows.map((r: { subject_code: string; subject_label: string; grade: number; academic_year: string; section: string | null; week_count: number }) => ({
      subject_code: r.subject_code,
      subject_label: r.subject_label,
      grade: Number(r.grade),
      academic_year: r.academic_year,
      section: r.section ?? null,
      week_count: Number(r.week_count) || 0,
    }));
  }

  /** Hangi derse hangi sınıf/grup/yıl için plan hazır – özet liste (superadmin) */
  async findSummary(curriculumModel?: string | null): Promise<
    Array<{
      subject_code: string;
      subject_label: string;
      grade: number | null;
      ana_grup: string | null;
      alt_grup: string | null;
      academic_year: string;
      section: string | null;
      week_count: number;
    }>
  > {
    const isBilsem = curriculumModel?.trim() === 'bilsem';
    const qb = this.repo
      .createQueryBuilder('yp')
      .select('yp.subject_code', 'subject_code')
      .addSelect('yp.subject_label', 'subject_label')
      .addSelect('yp.grade', 'grade')
      .addSelect('yp.ana_grup', 'ana_grup')
      .addSelect('yp.alt_grup', 'alt_grup')
      .addSelect('yp.academic_year', 'academic_year')
      .addSelect('yp.section', 'section')
      .addSelect('COUNT(yp.id)', 'week_count');
    this.applyCurriculumFilter(qb, curriculumModel);
    qb.groupBy('yp.subject_code')
      .addGroupBy('yp.subject_label')
      .addGroupBy('yp.academic_year')
      .addGroupBy('yp.section');
    if (isBilsem) {
      qb.addGroupBy('yp.ana_grup').addGroupBy('yp.alt_grup')
        .orderBy('yp.academic_year', 'DESC')
        .addOrderBy('yp.subject_label', 'ASC')
        .addOrderBy('yp.ana_grup', 'ASC')
        .addOrderBy('yp.alt_grup', 'ASC');
    } else {
      qb.addGroupBy('yp.grade')
        .addGroupBy('yp.ana_grup')
        .addGroupBy('yp.alt_grup')
        .orderBy('yp.academic_year', 'DESC')
        .addOrderBy('yp.subject_label', 'ASC')
        .addOrderBy('yp.grade', 'ASC');
    }
    const rows = await qb.getRawMany();
    return rows.map((r) => ({
      subject_code: r.subject_code,
      subject_label: r.subject_label,
      grade: r.grade != null ? Number(r.grade) : null,
      ana_grup: r.ana_grup ?? null,
      alt_grup: r.alt_grup ?? null,
      academic_year: r.academic_year,
      section: r.section ?? null,
      week_count: Number(r.week_count) || 0,
    }));
  }

  async findAll(filters: {
    subject_code?: string;
    grade?: number;
    ana_grup?: string;
    alt_grup?: string;
    academic_year?: string;
    section?: string | null;
    curriculum_model?: string | null;
  }): Promise<YillikPlanIcerik[]> {
    const qb = this.repo
      .createQueryBuilder('yp')
      .orderBy('yp.week_order', 'ASC')
      .addOrderBy('yp.id', 'ASC');
    this.applyCurriculumFilter(qb, filters.curriculum_model);
    if (filters.subject_code?.trim()) {
      qb.andWhere('yp.subject_code = :subjectCode', { subjectCode: filters.subject_code.trim() });
    }
    if (filters.curriculum_model?.trim() === 'bilsem') {
      if (filters.ana_grup?.trim()) {
        qb.andWhere('yp.ana_grup = :anaGrup', { anaGrup: filters.ana_grup.trim() });
      }
      if (filters.alt_grup !== undefined && filters.alt_grup !== null) {
        if (filters.alt_grup === '') {
          qb.andWhere('(yp.alt_grup IS NULL OR yp.alt_grup = :empty)', { empty: '' });
        } else {
          qb.andWhere('yp.alt_grup = :altGrup', { altGrup: filters.alt_grup.trim() });
        }
      }
    } else if (filters.grade != null) {
      qb.andWhere('yp.grade = :grade', { grade: filters.grade });
    }
    if (filters.academic_year?.trim()) {
      qb.andWhere('yp.academic_year = :academicYear', { academicYear: filters.academic_year.trim() });
    }
    if (filters.section !== undefined) {
      if (filters.section == null || filters.section === '') {
        qb.andWhere('yp.section IS NULL');
      } else {
        qb.andWhere('yp.section = :section', { section: filters.section.trim() });
      }
    }
    return qb.getMany();
  }

  /** BİLSEM PÜY listesi/API: DB’de boş olan yardımcı sütunları gösterim için doldurur (kalıcı yazmaz). */
  attachBilsemPuyDisplayDefaults(items: YillikPlanIcerik[]): void {
    for (const e of items) {
      if (e.curriculumModel?.trim() !== 'bilsem') continue;
      const row: Record<string, unknown> = {
        sosyal_duygusal: e.sosyalDuygusal ?? '',
        degerler: e.degerler ?? '',
        okuryazarlik_becerileri: e.okuryazarlikBecerileri ?? '',
        belirli_gun_haftalar: e.belirliGunHaftalar ?? '',
        zenginlestirme: e.zenginlestirme ?? '',
        okul_temelli_planlama: e.okulTemelliPlanlama ?? '',
      };
      applyBilsemPuyMergeRowDefaults(row, e.weekOrder, {
        unite: e.unite,
        konu: e.konu,
        kazanimlar: e.kazanimlar,
      });
      e.sosyalDuygusal = String(row.sosyal_duygusal ?? '');
      e.degerler = String(row.degerler ?? '');
      e.okuryazarlikBecerileri = String(row.okuryazarlik_becerileri ?? '');
      e.belirliGunHaftalar = String(row.belirli_gun_haftalar ?? '');
      e.zenginlestirme = String(row.zenginlestirme ?? '');
      e.okulTemelliPlanlama = String(row.okul_temelli_planlama ?? '');
    }
  }

  async findOne(id: string): Promise<YillikPlanIcerik> {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Kayıt bulunamadı.' });
    }
    return item;
  }

  async create(dto: CreateYillikPlanIcerikDto): Promise<YillikPlanIcerik> {
    const isBilsem = dto.curriculum_model?.trim() === 'bilsem';
    if (isBilsem) {
      if (!dto.ana_grup?.trim()) {
        throw new BadRequestException({ code: 'ANA_GRUP_REQUIRED', message: 'BİLSEM için ana grup zorunludur.' });
      }
    } else if (dto.grade == null || dto.grade < 1 || dto.grade > 12) {
      throw new BadRequestException({ code: 'GRADE_REQUIRED', message: 'Sınıf (1-12) zorunludur.' });
    }
    const entity = this.repo.create({
      subjectCode: dto.subject_code,
      subjectLabel: dto.subject_label,
      grade: isBilsem ? null : (dto.grade ?? null),
      anaGrup: dto.ana_grup?.trim() || null,
      altGrup: dto.alt_grup?.trim() || null,
      section: dto.section ?? null,
      academicYear: dto.academic_year,
      weekOrder: dto.week_order,
      unite: dto.unite ?? null,
      konu: dto.konu ?? null,
      kazanimlar: dto.kazanimlar ?? null,
      dersSaati: dto.ders_saati ?? 0,
      belirliGunHaftalar: dto.belirli_gun_haftalar ?? null,
      surecBilesenleri: dto.surec_bilesenleri ?? null,
      olcmeDegerlendirme: dto.olcme_degerlendirme ?? null,
      sosyalDuygusal: dto.sosyal_duygusal ?? null,
      degerler: dto.degerler ?? null,
      okuryazarlikBecerileri: dto.okuryazarlik_becerileri ?? null,
      zenginlestirme: dto.zenginlestirme ?? null,
      okulTemelliPlanlama: dto.okul_temelli_planlama ?? null,
      sortOrder: dto.sort_order ?? null,
      curriculumModel: dto.curriculum_model?.trim() || null,
    });
    return this.repo.save(entity);
  }

  async update(id: string, dto: UpdateYillikPlanIcerikDto): Promise<YillikPlanIcerik> {
    const entity = await this.findOne(id);
    if (dto.subject_code !== undefined) entity.subjectCode = dto.subject_code;
    if (dto.subject_label !== undefined) entity.subjectLabel = dto.subject_label;
    if (dto.grade !== undefined) entity.grade = dto.grade;
    if (dto.ana_grup !== undefined) entity.anaGrup = dto.ana_grup?.trim() || null;
    if (dto.alt_grup !== undefined) entity.altGrup = dto.alt_grup?.trim() || null;
    if (dto.section !== undefined) entity.section = dto.section;
    if (dto.academic_year !== undefined) entity.academicYear = dto.academic_year;
    if (dto.week_order !== undefined) entity.weekOrder = dto.week_order;
    if (dto.unite !== undefined) entity.unite = dto.unite;
    if (dto.konu !== undefined) entity.konu = dto.konu;
    if (dto.kazanimlar !== undefined) entity.kazanimlar = dto.kazanimlar;
    if (dto.ders_saati !== undefined) entity.dersSaati = dto.ders_saati;
    if (dto.belirli_gun_haftalar !== undefined) entity.belirliGunHaftalar = dto.belirli_gun_haftalar;
    if (dto.surec_bilesenleri !== undefined) entity.surecBilesenleri = dto.surec_bilesenleri;
    if (dto.olcme_degerlendirme !== undefined) entity.olcmeDegerlendirme = dto.olcme_degerlendirme;
    if (dto.sosyal_duygusal !== undefined) entity.sosyalDuygusal = dto.sosyal_duygusal;
    if (dto.degerler !== undefined) entity.degerler = dto.degerler;
    if (dto.okuryazarlik_becerileri !== undefined) entity.okuryazarlikBecerileri = dto.okuryazarlik_becerileri;
    if (dto.zenginlestirme !== undefined) entity.zenginlestirme = dto.zenginlestirme;
    if (dto.okul_temelli_planlama !== undefined) entity.okulTemelliPlanlama = dto.okul_temelli_planlama;
    if (dto.sort_order !== undefined) entity.sortOrder = dto.sort_order;
    if (dto.curriculum_model !== undefined) entity.curriculumModel = dto.curriculum_model?.trim() || null;
    return this.repo.save(entity);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.repo.delete(id);
  }

  /** Filtrelere göre toplu silme. MEB: grade zorunlu; BİLSEM: ana_grup zorunlu. */
  async bulkDelete(filters: {
    subject_code: string;
    grade?: number;
    ana_grup?: string;
    alt_grup?: string;
    academic_year: string;
    curriculum_model?: string | null;
  }): Promise<number> {
    if (!filters.subject_code?.trim() || !filters.academic_year?.trim()) return 0;
    const isBilsem = filters.curriculum_model?.trim() === 'bilsem';
    const qb = this.repo
      .createQueryBuilder()
      .delete()
      .from(YillikPlanIcerik)
      .where('subject_code = :sc', { sc: filters.subject_code.trim() })
      .andWhere('academic_year = :ay', { ay: filters.academic_year.trim() });
    if (isBilsem) {
      if (!filters.ana_grup?.trim()) return 0;
      qb.andWhere('curriculum_model = :cm', { cm: 'bilsem' })
        .andWhere('ana_grup = :anaGrup', { anaGrup: filters.ana_grup.trim() });
      if (filters.alt_grup !== undefined && filters.alt_grup !== null) {
        if (filters.alt_grup === '') {
          qb.andWhere('(alt_grup IS NULL OR alt_grup = :empty)', { empty: '' });
        } else {
          qb.andWhere('alt_grup = :altGrup', { altGrup: filters.alt_grup.trim() });
        }
      }
    } else {
      if (filters.grade == null) return 0;
      qb.andWhere('grade = :g', { g: filters.grade })
        .andWhere('(curriculum_model IS NULL OR curriculum_model = :empty)', { empty: '' });
    }
    const result = await qb.execute();
    return result.affected ?? 0;
  }

  /** GPT taslağından veya MEB import'tan toplu kayıt oluştur. Aynı ders/sınıf/yıl için mevcut kayıtlar silinir. */
  async bulkCreate(params: {
    subject_code: string;
    subject_label: string;
    grade: number;
    section?: string;
    academic_year: string;
    curriculum_model?: string | null;
    items: Array<{
      week_order: number;
      unite?: string;
      konu?: string;
      kazanimlar?: string;
      ders_saati?: number;
      belirli_gun_haftalar?: string;
      surec_bilesenleri?: string;
      olcme_degerlendirme?: string;
      sosyal_duygusal?: string;
      degerler?: string;
      okuryazarlik_becerileri?: string;
      zenginlestirme?: string;
      okul_temelli_planlama?: string;
    }>;
  }): Promise<YillikPlanIcerik[]> {
    const grade = Number(params.grade);
    if (!Number.isFinite(grade) || grade < 1 || grade > 12) {
      throw new BadRequestException({ code: 'INVALID_GRADE', message: 'Geçerli sınıf (1-12) girin.' });
    }
    const academicYear = String(params.academic_year ?? '').trim();
    if (!academicYear) {
      throw new BadRequestException({ code: 'INVALID_ACADEMIC_YEAR', message: 'Öğretim yılı zorunludur.' });
    }
    const subjectCode = String(params.subject_code ?? '').trim();
    if (!subjectCode) {
      throw new BadRequestException({ code: 'INVALID_SUBJECT', message: 'Ders kodu zorunludur.' });
    }
    if (!Array.isArray(params.items) || params.items.length === 0) {
      throw new BadRequestException({ code: 'EMPTY_ITEMS', message: 'En az bir hafta verisi gerekir.' });
    }
    const sortedItems = [...params.items].sort((a, b) => {
      const wa = Number(a.week_order);
      const wb = Number(b.week_order);
      const na = Number.isFinite(wa) ? wa : 0;
      const nb = Number.isFinite(wb) ? wb : 0;
      return na - nb;
    });
    const cm = params.curriculum_model?.trim() === 'bilsem' ? 'bilsem' : null;
    try {
      const delQb = this.repo
        .createQueryBuilder()
        .delete()
        .from(YillikPlanIcerik)
        .where('subject_code = :sc', { sc: subjectCode })
        .andWhere('grade = :g', { g: grade })
        .andWhere('academic_year = :ay', { ay: academicYear });
      if (cm) {
        delQb.andWhere('curriculum_model = :cm', { cm });
      } else {
        delQb.andWhere('(curriculum_model IS NULL OR curriculum_model = :empty)', { empty: '' });
      }
      await delQb.execute();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Silme işlemi başarısız';
      throw new BadRequestException({ code: 'BULK_DELETE_FAILED', message: `Mevcut plan silinemedi: ${msg}` });
    }
    const trunc = (v: string | null | undefined, max: number) =>
      v != null && String(v).trim() ? String(v).trim().slice(0, max) || null : null;
    const entities = sortedItems.map((item, idx) => {
      const wo = Number(item.week_order);
      const ds = Number(item.ders_saati);
      return this.repo.create({
        subjectCode,
        subjectLabel: String(params.subject_label ?? '').trim() || subjectCode,
        grade,
        section: params.section ?? null,
        academicYear,
        weekOrder: Number.isFinite(wo) && wo >= 1 && wo <= 38 ? Math.round(wo) : idx + 1,
        unite: trunc(item.unite, 256),
        konu: trunc(item.konu, 512),
        kazanimlar: item.kazanimlar?.trim() || null,
        dersSaati: Number.isFinite(ds) && ds >= 0 ? Math.round(ds) : 2,
        belirliGunHaftalar: trunc(item.belirli_gun_haftalar, 256),
        surecBilesenleri: item.surec_bilesenleri?.trim() || null,
        olcmeDegerlendirme: item.olcme_degerlendirme?.trim() || null,
        sosyalDuygusal: item.sosyal_duygusal?.trim() || null,
        degerler: item.degerler?.trim() || null,
        okuryazarlikBecerileri: item.okuryazarlik_becerileri?.trim() || null,
        zenginlestirme: item.zenginlestirme?.trim() || null,
        okulTemelliPlanlama: item.okul_temelli_planlama?.trim() || null,
        sortOrder: null,
        curriculumModel: cm,
      });
    });
    try {
      return await this.repo.save(entities);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Kayıt işlemi başarısız';
      throw new BadRequestException({ code: 'BULK_SAVE_FAILED', message: `Plan kaydedilemedi: ${msg}` });
    }
  }

  /** Plan meta (tablo altı not) – MEB: grade; BİLSEM: anaGrup, altGrup */
  async getMeta(
    subjectCode: string,
    gradeOrAna: number | string,
    academicYear: string,
    curriculumModel?: string | null,
    altGrup?: string | null,
  ): Promise<string | null> {
    const key = buildPlanKey(subjectCode, gradeOrAna, academicYear, curriculumModel, altGrup);
    const meta = await this.metaRepo.findOne({ where: { planKey: key } });
    return meta?.tabloAltiNot ?? null;
  }

  /** Plan meta güncelle (tablo altı not) */
  async upsertMeta(
    subjectCode: string,
    gradeOrAna: number | string,
    academicYear: string,
    tabloAltiNot: string | null,
    curriculumModel?: string | null,
    altGrup?: string | null,
  ): Promise<void> {
    const key = buildPlanKey(subjectCode, gradeOrAna, academicYear, curriculumModel, altGrup);
    const meta = await this.metaRepo.findOne({ where: { planKey: key } });
    const value = tabloAltiNot?.trim() || null;
    if (meta) {
      meta.tabloAltiNot = value;
      await this.metaRepo.save(meta);
    } else if (value) {
      await this.metaRepo.save(this.metaRepo.create({ planKey: key, tabloAltiNot: value }));
    }
  }
}
