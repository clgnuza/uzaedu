import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { School } from './entities/school.entity';
import { normalizeReviewPlacementScoresJson, type ReviewPlacementScoreRow } from './review-placement-scores.util';
import { env } from '../config/env';

export type PlacementFeedRow = {
  institution_code?: string | null;
  school_id?: string | null;
  year: number;
  with_exam?: number | null;
  without_exam?: number | null;
};

/** Besleme birleştirme kapsamı (JSON `update_scope` / CSV query). */
export type PlacementUpdateScope = 'both' | 'central_only' | 'local_only';

export function normalizePlacementUpdateScope(raw: unknown): PlacementUpdateScope {
  if (raw == null || raw === '') return 'both';
  const s = String(raw).trim().toLowerCase();
  if (
    ['central_only', 'merkezi_only', 'merkezi', 'lgs_only', 'puanli', 'puanlı', 'sinavli', 'sınavlı'].includes(s)
  ) {
    return 'central_only';
  }
  if (
    ['local_only', 'yerel_only', 'yerel', 'obp_only', 'puansiz', 'puansız', 'sinavsiz', 'sınavsız'].includes(s)
  ) {
    return 'local_only';
  }
  return 'both';
}

export type PlacementFeedPayload = {
  rows: PlacementFeedRow[];
  /** Merkezî + yerel sütunu dolu okullarda kartı aç (varsayılan true) */
  auto_enable_dual_track?: boolean;
  /**
   * İki ayrı besleme (merkezî LGS vs yerel) karışmasın diye:
   * - central_only: yalnızca with_exam güncellenir
   * - local_only: yalnızca without_exam güncellenir
   * - both: ikisi (varsayılan)
   */
  update_scope?: PlacementUpdateScope;
};

/** applyRows sonrası güncellenen okullar (yanıt boyutu için sınırlı). */
export type PlacementUpdatedSchoolRef = {
  id: string;
  name: string;
  institution_code: string | null;
};

const PLACEMENT_UPDATED_SCHOOLS_MAX = 500;

export type PlacementSyncResult = {
  ok: boolean;
  feed_url_configured: boolean;
  updated: number;
  skipped_no_match: number;
  row_errors: string[];
  message?: string;
  /** Güncellenen okullar (en fazla PLACEMENT_UPDATED_SCHOOLS_MAX) */
  updated_schools?: PlacementUpdatedSchoolRef[];
  /** `updated` sayısı listeden büyükse true */
  updated_schools_truncated?: boolean;
  /** Bu uygulamada kullanılan birleştirme kapsamı */
  update_scope?: PlacementUpdateScope;
};

function trimStr(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function strField(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

/**
 * JSON / harici besleme satırını iç modele çevirir (MEB güncel diline uygun takma adlar).
 * Merkezî: with_exam | merkezi_lgs | merkezi_taban | lgs_taban
 * Yerel: without_exam | yerel_taban | yerel_obp | yerel
 */
export function normalizeRawRowToPlacement(o: Record<string, unknown>, index: number): PlacementFeedRow {
  const institution_code =
    [strField(o.institution_code), strField(o.kurum_kodu), strField(o.meb_kurum_kodu), strField(o.kurumKodu)].find(
      (x) => x.length > 0,
    ) ?? null;
  const school_id = [strField(o.school_id), strField(o.okul_id)].find((x) => x.length > 0) ?? null;
  const yRaw = o.year ?? o.yil ?? o.Yil;
  const year = typeof yRaw === 'number' ? yRaw : parseInt(String(yRaw ?? ''), 10);
  if (!Number.isFinite(year) || year < 1990 || year > 2100) {
    throw new Error(`rows[${index}]: geçerli yıl (year/yil) gerekli`);
  }
  if (!institution_code && !school_id) {
    throw new Error(`rows[${index}]: institution_code/kurum_kodu veya school_id/okul_id gerekli`);
  }
  const row: PlacementFeedRow = { institution_code, school_id, year };
  const centralKeys = ['with_exam', 'merkezi_lgs', 'merkezi_taban', 'lgs_taban', 'merkezi', 'central_lgs'] as const;
  for (const k of centralKeys) {
    if (Object.prototype.hasOwnProperty.call(o, k)) {
      row.with_exam = numOrNull(o[k]);
      break;
    }
  }
  const localKeys = ['without_exam', 'yerel_taban', 'yerel', 'yerel_obp', 'local'] as const;
  for (const k of localKeys) {
    if (Object.prototype.hasOwnProperty.call(o, k)) {
      row.without_exam = numOrNull(o[k]);
      break;
    }
  }
  return row;
}

/** UTF-8 BOM kaldır, satır sonları normalize et */
function stripBom(s: string): string {
  if (s.charCodeAt(0) === 0xfeff) return s.slice(1);
  return s;
}

@Injectable()
export class SchoolPlacementScoresSyncService {
  private readonly logger = new Logger(SchoolPlacementScoresSyncService.name);

  constructor(@InjectRepository(School) private readonly schoolRepo: Repository<School>) {}

  isFeedConfigured(): boolean {
    return !!env.schoolPlacementScores.feedUrl?.trim();
  }

  parseJsonPayload(raw: string): PlacementFeedPayload {
    const data = JSON.parse(raw) as {
      rows?: unknown[];
      auto_enable_dual_track?: boolean;
      update_scope?: unknown;
      placement_update_scope?: unknown;
    };
    if (!data || !Array.isArray(data.rows)) {
      throw new Error('JSON: "rows" dizisi gerekli.');
    }
    const rows: PlacementFeedRow[] = [];
    for (let i = 0; i < data.rows.length; i++) {
      const item = data.rows[i];
      if (!item || typeof item !== 'object') {
        throw new Error(`rows[${i}] nesne olmalı`);
      }
      rows.push(normalizeRawRowToPlacement(item as Record<string, unknown>, i));
    }
    const update_scope = normalizePlacementUpdateScope(
      data.update_scope ?? data.placement_update_scope,
    );
    return { rows, auto_enable_dual_track: data.auto_enable_dual_track, update_scope };
  }

  /**
   * CSV: kurum/yıl + merkezî/yerel sütunları (takma adlar kabul edilir).
   * Ayırıcı ; veya , (başlıktan çıkarım).
   */
  parseCsv(buffer: Buffer): PlacementFeedRow[] {
    const text = stripBom(buffer.toString('utf8')).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) return [];
    const header = lines[0].toLowerCase();
    const delim = header.includes(';') && !header.includes(',') ? ';' : ',';
    const cols = lines[0].split(delim).map((c) => c.trim().toLowerCase().replace(/^\ufeff/, ''));
    const idx = (name: string) => cols.findIndex((c) => c === name || c.replace(/\s/g, '_') === name);
    const idxAny = (...names: string[]) => {
      for (const n of names) {
        const i = idx(n);
        if (i >= 0) return i;
      }
      return -1;
    };
    const ic = idxAny('institution_code', 'kurum_kodu', 'meb_kurum_kodu');
    const sid = idxAny('school_id', 'okul_id');
    const y = idxAny('year', 'yil');
    const we = idxAny('with_exam', 'merkezi_lgs', 'merkezi_taban', 'lgs_taban', 'merkezi');
    const wo = idxAny('without_exam', 'yerel_taban', 'yerel', 'yerel_obp', 'local');
    if (y < 0) throw new Error('CSV: "year" veya "yil" sütunu gerekli.');
    if (ic < 0 && sid < 0) throw new Error('CSV: institution_code/kurum_kodu veya school_id/okul_id gerekli.');
    const rows: PlacementFeedRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const p = lines[i].split(delim).map((c) => c.trim());
      const year = parseInt(p[y] ?? '', 10);
      if (!Number.isFinite(year)) continue;
      const institution_code = ic >= 0 ? p[ic] || null : null;
      const school_id = sid >= 0 ? p[sid] || null : null;
      if (!institution_code && !school_id) continue;
      const row: PlacementFeedRow = { institution_code, school_id, year };
      if (we >= 0 && p[we] !== '') Object.assign(row, { with_exam: numOrNull(p[we]) });
      if (wo >= 0 && p[wo] !== '') Object.assign(row, { without_exam: numOrNull(p[wo]) });
      rows.push(row);
    }
    return rows;
  }

  async fetchRemoteFeed(): Promise<PlacementFeedPayload> {
    const url = env.schoolPlacementScores.feedUrl?.trim();
    if (!url) throw new Error('SCHOOL_PLACEMENT_SCORES_FEED_URL tanımlı değil.');
    const headers: Record<string, string> = { Accept: 'application/json' };
    const tok = env.schoolPlacementScores.feedBearerToken?.trim();
    if (tok) headers.Authorization = `Bearer ${tok}`;
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 90_000);
    try {
      const res = await fetch(url, { headers, signal: ac.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.text();
      return this.parseJsonPayload(raw);
    } finally {
      clearTimeout(t);
    }
  }

  /**
   * Aynı okula ait satırları birleştirir, mevcut json ile yıllık merge eder, normalize eder ve kaydeder.
   * @param opts.restrictToSchoolIds — GPT / kısmi liste: kurum kodu çakışmasında listede olmayan okul güncellenmesin
   *   (aynı `institution_code` birden fazla satırda varsa bu id kümesi içinde tek eşleşme aranır).
   */
  async applyRows(
    rows: PlacementFeedRow[],
    autoEnableDualTrack = true,
    updateScope: PlacementUpdateScope = 'both',
    opts?: { restrictToSchoolIds?: string[] },
  ): Promise<PlacementSyncResult> {
    const row_errors: string[] = [];
    const bySchool = new Map<string, PlacementFeedRow[]>();
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const code = trimStr(r.institution_code);
      const sid = trimStr(r.school_id);
      const year = typeof r.year === 'number' ? r.year : parseInt(String(r.year), 10);
      if (!Number.isFinite(year) || year < 1990 || year > 2100) {
        row_errors.push(`satır ${i + 1}: geçersiz yıl`);
        continue;
      }
      const key = code ? `c:${code}` : sid ? `i:${sid}` : '';
      if (!key) {
        row_errors.push(`satır ${i + 1}: kurum_kodu/institution_code veya school_id gerekli`);
        continue;
      }
      const list = bySchool.get(key) ?? [];
      list.push({ ...r, institution_code: code || null, school_id: sid || null, year });
      bySchool.set(key, list);
    }

    let updated = 0;
    let skipped_no_match = 0;
    const updated_schools: PlacementUpdatedSchoolRef[] = [];
    const restrictIds = opts?.restrictToSchoolIds?.filter((x) => typeof x === 'string' && x.length > 0);
    const restrictSet = restrictIds?.length ? new Set(restrictIds) : null;

    for (const [key, incList] of bySchool) {
      let school: School | null = null;
      if (key.startsWith('c:')) {
        const code = key.slice(2);
        if (restrictSet?.size) {
          const ids = [...restrictSet];
          const matches = await this.schoolRepo.find({
            where: { institutionCode: code, id: In(ids) },
            take: 2,
          });
          if (matches.length === 0) {
            skipped_no_match += incList.length;
            continue;
          }
          if (matches.length > 1) {
            row_errors.push(
              `kurum_kodu ${code}: seçilen okul listesinde ${matches.length} kayıt; hangi okul güncelleneceği belirsiz, atlandı`,
            );
            skipped_no_match += incList.length;
            continue;
          }
          school = matches[0] ?? null;
        } else {
          school = await this.schoolRepo.findOne({ where: { institutionCode: code } });
        }
      } else {
        const id = key.slice(2);
        if (restrictSet?.size && !restrictSet.has(id)) {
          skipped_no_match += incList.length;
          continue;
        }
        school = await this.schoolRepo.findOne({ where: { id } });
      }
      if (!school) {
        skipped_no_match += incList.length;
        continue;
      }

      const yearMap = new Map<number, ReviewPlacementScoreRow>();
      for (const ex of school.review_placement_scores ?? []) {
        if (ex && typeof ex.year === 'number') yearMap.set(ex.year, { ...ex });
      }
      for (const inc of incList) {
        const y = inc.year;
        const prev = yearMap.get(y) ?? { year: y, with_exam: null, without_exam: null };
        const next: ReviewPlacementScoreRow = { ...prev };
        if (updateScope === 'both' || updateScope === 'central_only') {
          if (Object.prototype.hasOwnProperty.call(inc, 'with_exam')) {
            next.with_exam = numOrNull(inc.with_exam);
          }
        }
        if (updateScope === 'both' || updateScope === 'local_only') {
          if (Object.prototype.hasOwnProperty.call(inc, 'without_exam')) {
            next.without_exam = numOrNull(inc.without_exam);
          }
        }
        yearMap.set(y, next);
      }
      const merged = normalizeReviewPlacementScoresJson([...yearMap.values()]);
      school.review_placement_scores = merged;
      if (autoEnableDualTrack && merged && merged.length > 0) {
        const hasCentral = merged.some((x) => x.with_exam != null);
        const hasLocal = merged.some((x) => x.without_exam != null);
        if (hasCentral && hasLocal) school.review_placement_dual_track = true;
      }
      await this.schoolRepo.save(school);
      updated += 1;
      if (updated_schools.length < PLACEMENT_UPDATED_SCHOOLS_MAX) {
        updated_schools.push({
          id: school.id,
          name: school.name,
          institution_code: school.institutionCode ?? null,
        });
      }
    }

    return {
      ok: true,
      feed_url_configured: this.isFeedConfigured(),
      updated,
      skipped_no_match,
      row_errors,
      updated_schools,
      updated_schools_truncated: updated > updated_schools.length,
      update_scope: updateScope,
    };
  }

  /**
   * @param uiOverrideRaw Panelden gelen `update_scope`; boşsa yalnızca JSON’daki `update_scope` kullanılır.
   * Panel `both` iken JSON’daki değer (ör. yerel_only) geçerlidir. Panel `both` dışındaysa panel önceliklidir.
   */
  async syncFromRemoteFeed(uiOverrideRaw?: string): Promise<PlacementSyncResult> {
    if (!this.isFeedConfigured()) {
      return {
        ok: false,
        feed_url_configured: false,
        updated: 0,
        skipped_no_match: 0,
        row_errors: [],
        message: 'SCHOOL_PLACEMENT_SCORES_FEED_URL tanımlı değil.',
      };
    }
    try {
      const payload = await this.fetchRemoteFeed();
      const auto = payload.auto_enable_dual_track !== false;
      const fromPayload = normalizePlacementUpdateScope(payload.update_scope);
      const fromUi =
        uiOverrideRaw !== undefined && String(uiOverrideRaw).trim() !== ''
          ? normalizePlacementUpdateScope(uiOverrideRaw)
          : 'both';
      const scope = fromUi !== 'both' ? fromUi : fromPayload;
      return await this.applyRows(payload.rows ?? [], auto, scope);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`placement feed sync failed: ${msg}`);
      return {
        ok: false,
        feed_url_configured: true,
        updated: 0,
        skipped_no_match: 0,
        row_errors: [msg],
        message: msg,
      };
    }
  }

  @Cron('0 4 * * *', { timeZone: 'Europe/Istanbul' })
  async cronSyncPlacementScores(): Promise<void> {
    if (!this.isFeedConfigured()) return;
    const r = await this.syncFromRemoteFeed();
    this.logger.log(`placement scores cron: updated=${r.updated} skipped=${r.skipped_no_match} ok=${r.ok}`);
  }
}
