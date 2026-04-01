/**
 * Sınav görevi otomatik sync – RSS ve HTML scrape kaynaklarından exam_duties'e.
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { XMLParser } from 'fast-xml-parser';
import * as cheerio from 'cheerio';
import { ExamDutySyncSource } from './entities/exam-duty-sync-source.entity';
import { ExamDuty } from './entities/exam-duty.entity';
import {
  EXAM_DUTY_CATEGORIES,
  formatExamDutySyncTitle,
  getApplicationUrlForCategory,
  normalizeExamDutyCategorySlug,
  type DateValidationStatus,
} from './entities/exam-duty.entity';
import { ExamDutyGptService, type ExamDutyExtractResult } from './exam-duty-gpt.service';
import { AppConfigService } from '../app-config/app-config.service';
import { User } from '../users/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { UserRole } from '../types/enums';

const FETCH_TIMEOUT_MS = 30000;
const RSS_ITEM_LIMIT = 50;
const FETCH_RETRIES = 2;
const GPT_DELAY_MS = 300;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** URL'yi external_id için normalize et – trailing slash, utm/fbclid parametreleri kaldır */
function normalizeExternalId(url: string): string {
  let u = url.trim();
  const qIdx = u.indexOf('?');
  if (qIdx > 0) {
    const base = u.slice(0, qIdx);
    const qs = u.slice(qIdx + 1);
    if (qs) {
      const keep: string[] = [];
      for (const p of qs.split('&')) {
        const eq = p.indexOf('=');
        const key = eq > 0 ? decodeURIComponent(p.slice(0, eq)).toLowerCase() : p;
        if (!['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid'].includes(key)) {
          keep.push(p);
        }
      }
      u = keep.length ? `${base}?${keep.join('&')}` : base;
    } else {
      u = base;
    }
  }
  return u.replace(/\/+$/, '') || u;
}

function extractText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object') {
    if ('#text' in value) return String((value as { '#text'?: string })['#text'] ?? '').trim();
    if ('_' in value) return String((value as { _?: string })._ ?? '').trim();
  }
  return String(value).trim();
}

function extractLink(entry: Record<string, unknown>, baseUrl?: string | null): string {
  const link = entry.link ?? entry.guid ?? entry.id ?? entry.url;
  let href = '';
  if (typeof link === 'string') href = link;
  else if (link && typeof link === 'object') {
    const obj = link as Record<string, unknown>;
    href = String(obj['#text'] ?? obj._ ?? obj.href ?? obj['@_href'] ?? '').trim();
  }
  if (!href) return '';
  if (baseUrl && href.startsWith('/')) {
    const base = baseUrl.replace(/\/$/, '');
    href = `${base}${href}`;
  }
  return href;
}

function parseRssDate(value: unknown): Date | null {
  if (!value) return null;
  const str = String(value).trim();
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function matchesKeywords(title: string, keywords: string | null): boolean {
  if (!keywords?.trim()) return true;
  const lower = title.toLowerCase();
  const parts = keywords.toLowerCase().split(/[\s,;]+/).filter(Boolean);
  return parts.some((p) => lower.includes(p));
}

async function fetchWithRetry(url: string, init: RequestInit, retries = FETCH_RETRIES, timeoutMs?: number): Promise<Response> {
  const signal = timeoutMs != null && timeoutMs > 0 ? AbortSignal.timeout(timeoutMs) : init.signal;
  const mergedInit = { ...init, signal };
  let lastError: Error | null = null;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, mergedInit);
      if (res.ok || res.status < 500) return res;
      lastError = new Error(`HTTP ${res.status}`);
      if (i < retries) await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (i < retries) await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  throw lastError ?? new Error('Fetch failed');
}

const MAX_LAST_SKIPPED_ITEMS = 300;

/** runSync dönüş tipi (SyncSourceResult/ExamDutySkippedItem aşağıda tanımlı) */
type RunSyncResult = {
  ok: boolean;
  message: string;
  total_created: number;
  total_restored: number;
  total_gpt_errors: number;
  /** Ayarlardaki max yeni duyuru limiti (0 = sınırsız) */
  quota_limit: number;
  /** Kota dolduğu için atlanan link sayısı (sıra ile kontrol, limit 1 ise 0 veya 1 eklendi + N kota atlandı) */
  quota_skipped: number;
  results: SyncSourceResult[];
  skipped_items: ExamDutySkippedItem[];
};

@Injectable()
export class ExamDutySyncService {
  private readonly logger = new Logger(ExamDutySyncService.name);
  private lastSkippedItems: ExamDutySkippedItem[] = [];
  private lastSyncCompletedAt: Date | null = null;
  private lastTotalCreated = 0;
  private lastTotalRestored = 0;
  private lastTotalGptErrors = 0;
  /** Son sync detay logu (sync-health ile döner) */
  private lastSyncLog: { at: string; dry_run: boolean; message: string; results: SyncSourceResult[]; quota_skipped: number } | null = null;
  /** Aynı anda tek sync: önceki bitene kadar beklenir, ard arda çalışmaz */
  private syncPromise: Promise<RunSyncResult> | null = null;

  constructor(
    @InjectRepository(ExamDutySyncSource)
    private readonly sourceRepo: Repository<ExamDutySyncSource>,
    @InjectRepository(ExamDuty)
    private readonly dutyRepo: Repository<ExamDuty>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly gptService: ExamDutyGptService,
    private readonly appConfig: AppConfigService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getSources(): Promise<ExamDutySyncSource[]> {
    return this.sourceRepo.find({
      order: { sortOrder: 'ASC', label: 'ASC' },
    });
  }

  async getSourceById(id: string): Promise<ExamDutySyncSource | null> {
    return this.sourceRepo.findOne({ where: { id } });
  }

  async createSource(data: {
    key: string;
    label: string;
    categorySlug: string;
    rssUrl?: string | null;
    baseUrl?: string | null;
    scrapeConfig?: Record<string, unknown> | null;
    titleKeywords?: string | null;
    isActive?: boolean;
    sortOrder?: number;
  }): Promise<ExamDutySyncSource> {
    const existing = await this.sourceRepo.findOne({ where: { key: data.key } });
    if (existing) throw new Error(`Kaynak anahtarı zaten mevcut: ${data.key}`);
    const source = this.sourceRepo.create({
      key: data.key,
      label: data.label,
      categorySlug: data.categorySlug,
      rssUrl: data.rssUrl ?? null,
      baseUrl: data.baseUrl ?? null,
      scrapeConfig: data.scrapeConfig ?? null,
      titleKeywords: data.titleKeywords ?? null,
      isActive: data.isActive ?? true,
      sortOrder: data.sortOrder ?? 0,
    });
    return this.sourceRepo.save(source);
  }

  async updateSource(id: string, data: {
    label?: string;
    categorySlug?: string;
    rssUrl?: string | null;
    baseUrl?: string | null;
    scrapeConfig?: Record<string, unknown> | null;
    titleKeywords?: string | null;
    isActive?: boolean;
    sortOrder?: number;
  }): Promise<ExamDutySyncSource> {
    const source = await this.sourceRepo.findOne({ where: { id } });
    if (!source) throw new Error('Kaynak bulunamadı');
    if (data.label !== undefined) source.label = data.label;
    if (data.categorySlug !== undefined) source.categorySlug = data.categorySlug;
    if (data.rssUrl !== undefined) source.rssUrl = data.rssUrl;
    if (data.baseUrl !== undefined) source.baseUrl = data.baseUrl;
    if (data.scrapeConfig !== undefined) source.scrapeConfig = data.scrapeConfig;
    if (data.titleKeywords !== undefined) source.titleKeywords = data.titleKeywords;
    if (data.isActive !== undefined) source.isActive = data.isActive;
    if (data.sortOrder !== undefined) source.sortOrder = data.sortOrder;
    return this.sourceRepo.save(source);
  }

  async deleteSource(id: string): Promise<void> {
    const source = await this.sourceRepo.findOne({ where: { id } });
    if (!source) throw new Error('Kaynak bulunamadı');
    await this.sourceRepo.remove(source);
  }

  /** Tekil sync: başka sync çalışıyorsa bitene kadar bekler, sonra çalışır. dry_run: gerçek ekleme/güncelleme yapmaz. */
  async runSync(options?: { dry_run?: boolean }): Promise<RunSyncResult> {
    while (this.syncPromise) {
      await this.syncPromise;
    }
    const dryRun = options?.dry_run === true;
    this.syncPromise = this.doRunSync(dryRun);
    try {
      return await this.syncPromise;
    } finally {
      this.syncPromise = null;
    }
  }

  private async doRunSync(dryRun = false): Promise<RunSyncResult> {
    const sources = await this.sourceRepo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC' },
    });

    const syncable = sources.filter((s) => s.rssUrl?.trim() || (s.baseUrl?.trim() && s.scrapeConfig));
    const results: SyncSourceResult[] = [];
    let totalCreated = 0;
    let totalRestored = 0;
    let totalGptErrors = 0;

    const syncOptions = await this.appConfig.getExamDutySyncOptions();
    const scrapeKeys = syncable.filter((s) => s.baseUrl?.trim() && s.scrapeConfig).map((s) => s.key);
    let recheckDuties: ExamDuty[] = [];
    if (scrapeKeys.length > 0 && syncOptions.recheck_max_count > 0) {
      recheckDuties = await this.dutyRepo
        .createQueryBuilder('e')
        .where('e.deleted_at IS NOT NULL')
        .andWhere('e.source_url IS NOT NULL')
        .andWhere('e.source_key IS NOT NULL')
        .andWhere('e.source_key IN (:...keys)', { keys: scrapeKeys })
        .orderBy('e.deleted_at', 'ASC')
        .limit(syncOptions.recheck_max_count)
        .getMany();
    }

    const quota = {
      remaining: syncOptions.max_new_per_sync > 0 ? syncOptions.max_new_per_sync : Number.MAX_SAFE_INTEGER,
    };
    for (const source of syncable) {
      const recheckForThisSource = recheckDuties.filter((d) => d.sourceKey === source.key);
      const result = await this.syncSource(source, recheckForThisSource, {
        fetch_timeout_ms: syncOptions.fetch_timeout_ms,
        skip_past_exam_date: syncOptions.skip_past_exam_date,
        recheck_max_count: syncOptions.recheck_max_count,
        add_draft_without_dates: syncOptions.add_draft_without_dates,
        quota,
        dry_run: dryRun,
      });
      results.push(result);
      totalCreated += result.created;
      totalRestored += result.restored ?? 0;
      totalGptErrors += result.gpt_errors ?? 0;

      if (!dryRun) {
        const prevConsecutive = source.consecutiveErrorCount ?? 0;
        if (result.error) {
          source.consecutiveErrorCount = prevConsecutive + 1;
          if (source.consecutiveErrorCount >= 3) {
            await this.notifySuperadminsSyncSourceError(source, result.error);
            source.consecutiveErrorCount = 0;
          }
        } else {
          source.consecutiveErrorCount = 0;
        }
        source.lastSyncedAt = new Date();
        source.lastResultCreated = result.created;
        source.lastResultSkipped = result.skipped;
        source.lastResultError = result.error ?? null;
        if (result.last_processed_url !== undefined) {
          source.lastProcessedUrl = result.last_processed_url;
        }
        await this.sourceRepo.save(source);
      }
    }

    const allSkipped = results.flatMap((r) => r.skipped_items ?? []).slice(0, MAX_LAST_SKIPPED_ITEMS);
    this.lastSkippedItems = allSkipped;
    if (!dryRun) this.lastSyncCompletedAt = new Date();
    this.lastTotalCreated = totalCreated;
    this.lastTotalRestored = totalRestored;
    this.lastTotalGptErrors = totalGptErrors;

    const quotaLimit = syncOptions.max_new_per_sync > 0 ? syncOptions.max_new_per_sync : 0;
    const quotaSkippedCount = allSkipped.filter((s) => s.reason.includes('Sync kotası doldu')).length;

    const hasError = results.some((r) => r.error);
    const msgParts: string[] = [];
    if (dryRun) msgParts.push('(TEST MODU – veri kaydedilmedi)');
    if (totalCreated > 0) msgParts.push(`${totalCreated} yeni sınav görevi eklendi`);
    if (totalRestored > 0) msgParts.push(`${totalRestored} silinen duyuru geri yüklendi`);
    if (quotaLimit > 0) {
      if (quotaSkippedCount > 0) {
        msgParts.push(`Kota (max ${quotaLimit}): ${totalCreated} eklendi, ${quotaSkippedCount} link kota doldu ile atlandı`);
      } else {
        msgParts.push(`Kota (max ${quotaLimit}): ${totalCreated} eklendi`);
      }
    }
    const message = hasError
      ? 'Bazı kaynaklarda hata oluştu.'
      : msgParts.length > 0
        ? msgParts.join('. ')
        : 'Güncel. Yeni duyuru yok.';
    this.lastSyncLog = {
      at: new Date().toISOString(),
      dry_run: dryRun,
      message,
      results,
      quota_skipped: quotaSkippedCount,
    };
    return {
      ok: !hasError,
      message,
      total_created: totalCreated,
      total_restored: totalRestored,
      total_gpt_errors: totalGptErrors,
      quota_limit: quotaLimit,
      quota_skipped: quotaSkippedCount,
      results,
      skipped_items: allSkipped,
    };
  }

  getLastSkippedItems(): { items: ExamDutySkippedItem[]; synced_at: string | null } {
    return {
      items: this.lastSkippedItems,
      synced_at: this.lastSyncCompletedAt ? this.lastSyncCompletedAt.toISOString() : null,
    };
  }

  /** Sync ile eklenen verileri temizle (test için). Kaynak bazlı taslakları siler, last_processed_url sıfırlar. */
  async clearSyncData(sourceKey?: string): Promise<{ deleted: number; sources_reset: number }> {
    const keys = sourceKey
      ? [sourceKey]
      : (await this.sourceRepo.find({ select: ['key'] })).map((s) => s.key);
    let deleted = 0;
    let sourcesReset = 0;
    for (const key of keys) {
      const duties = await this.dutyRepo.find({
        where: { sourceKey: key, status: 'draft', deletedAt: IsNull() },
        select: ['id'],
      });
      for (const d of duties) {
        const item = await this.dutyRepo.findOne({ where: { id: d.id } });
        if (item) {
          item.deletedAt = new Date();
          await this.dutyRepo.save(item);
          deleted++;
        }
      }
      const src = await this.sourceRepo.findOne({ where: { key } });
      if (src) {
        src.lastProcessedUrl = null;
        await this.sourceRepo.save(src);
        sourcesReset++;
      }
    }
    this.logger.log(`[ExamDutySync] clearSyncData: ${deleted} taslak silindi, ${sourcesReset} kaynak last_processed_url sıfırlandı`);
    return { deleted, sources_reset: sourcesReset };
  }

  /** Sync sağlık özeti – son sync zamanı, kaynak bazlı durum, toplam oluşturulan/geri yüklenen/GPT hata */
  async getSyncHealth(): Promise<{
    last_sync_at: string | null;
    total_created_last_run: number;
    total_restored_last_run: number;
    total_gpt_errors_last_run: number;
    last_sync_log: { at: string; dry_run: boolean; message: string; results: SyncSourceResult[]; quota_skipped: number } | null;
    sources: Array<{
      key: string;
      label: string;
      last_synced_at: string | null;
      last_result_created: number;
      last_result_skipped: number;
      last_result_error: string | null;
      consecutive_error_count: number;
    }>;
  }> {
    const summary = this.getLastSyncSummary();
    const sources = await this.getSources();
    return {
      last_sync_at: summary.last_sync_at,
      total_created_last_run: summary.total_created,
      total_restored_last_run: summary.total_restored,
      total_gpt_errors_last_run: summary.total_gpt_errors,
      last_sync_log: this.lastSyncLog,
      sources: sources.map((s) => ({
        key: s.key,
        label: s.label,
        last_synced_at: s.lastSyncedAt ? s.lastSyncedAt.toISOString() : null,
        last_result_created: s.lastResultCreated ?? 0,
        last_result_skipped: s.lastResultSkipped ?? 0,
        last_result_error: s.lastResultError ?? null,
        consecutive_error_count: s.consecutiveErrorCount ?? 0,
      })),
    };
  }

  /** Son sync özeti – sync-health endpoint için */
  getLastSyncSummary(): {
    last_sync_at: string | null;
    total_created: number;
    total_restored: number;
    total_gpt_errors: number;
  } {
    return {
      last_sync_at: this.lastSyncCompletedAt ? this.lastSyncCompletedAt.toISOString() : null,
      total_created: this.lastTotalCreated,
      total_restored: this.lastTotalRestored,
      total_gpt_errors: this.lastTotalGptErrors,
    };
  }

  private async notifySuperadminsSyncSourceError(source: ExamDutySyncSource, errorMessage: string): Promise<void> {
    try {
      const superadmins = await this.userRepo.find({
        where: { role: UserRole.superadmin },
        select: ['id'],
      });
      const title = 'Sınav görevi sync: kaynak hatası';
      const body = `"${source.label}" (${source.key}) 3 kez üst üste hata verdi: ${errorMessage.slice(0, 200)}`;
      for (const sa of superadmins) {
        await this.notificationsService.createInboxEntry({
          user_id: sa.id,
          event_type: 'exam_duty.sync_source_error',
          entity_id: source.id,
          target_screen: '/sinav-gorevleri',
          title,
          body,
          metadata: { source_key: source.key, error: errorMessage },
        });
      }
      this.logger.warn(`[ExamDutySync] Superadmin'lere bildirim gönderildi: ${source.key} – ${errorMessage.slice(0, 80)}`);
    } catch (e) {
      this.logger.error(`[ExamDutySync] Superadmin bildirimi gönderilemedi: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  private async syncSource(
    source: ExamDutySyncSource,
    recheckDuties: ExamDuty[],
    options: {
      fetch_timeout_ms: number;
      skip_past_exam_date: boolean;
      recheck_max_count: number;
      add_draft_without_dates: boolean;
      quota: { remaining: number };
      dry_run?: boolean;
    },
  ): Promise<SyncSourceResult> {
    const base: SyncSourceResult = {
      source_key: source.key,
      source_label: source.label,
      created: 0,
      skipped: 0,
    };

    const dryRun = options.dry_run === true;
    try {
      if (source.rssUrl?.trim()) {
        const r = await this.syncFromRss(source, options.fetch_timeout_ms, options.quota, dryRun);
        base.created = r.created;
        base.skipped = r.skipped;
        base.skipped_items = r.skippedItems ?? [];
        base.gpt_errors = r.gpt_errors ?? 0;
      } else if (source.baseUrl?.trim() && source.scrapeConfig) {
        const r = await this.syncFromScrape(source, recheckDuties, {
          timeoutMs: options.fetch_timeout_ms,
          skipPastExamDate: options.skip_past_exam_date,
          addDraftWithoutDates: options.add_draft_without_dates ?? false,
          quota: options.quota,
          dryRun,
        });
        base.created = r.created;
        base.restored = r.restored ?? 0;
        base.skipped = r.skipped;
        base.skipped_items = r.skippedItems ?? [];
        base.gpt_errors = r.gpt_errors ?? 0;
        base.last_processed_url = r.lastProcessedUrl;
      } else {
        base.error = 'rss_url veya base_url+scrape_config tanımlı değil';
      }
    } catch (e) {
      base.error = e instanceof Error ? e.message : String(e);
    }

    return base;
  }

  private async syncFromRss(source: ExamDutySyncSource, timeoutMs: number = FETCH_TIMEOUT_MS, quota?: { remaining: number }, dryRun = false): Promise<{
    created: number;
    skipped: number;
    skippedItems: ExamDutySkippedItem[];
    gpt_errors: number;
  }> {
    const url = source.rssUrl!.trim();
    const res = await fetchWithRetry(
      url,
      {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/xml, application/xml, application/rss+xml, */*',
        },
      },
      FETCH_RETRIES,
      timeoutMs,
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const buffer = await res.arrayBuffer();
    const charset = res.headers.get('content-type')?.match(/charset=([^;]+)/i)?.[1]?.trim()?.toLowerCase() ?? 'utf-8';
    const xml = new TextDecoder(charset === 'utf-8' || charset === 'utf8' ? 'utf-8' : 'iso-8859-9').decode(buffer);

    const parser = new XMLParser({ ignoreAttributes: false, trimValues: true });
    const obj = parser.parse(xml);
    const channel = obj?.rss?.channel ?? obj?.feed;
    const rawItems = channel?.item ?? channel?.entry ?? [];
    const entries = (Array.isArray(rawItems) ? rawItems : [rawItems]).slice(0, RSS_ITEM_LIMIT);

    if (!EXAM_DUTY_CATEGORIES.includes(source.categorySlug as (typeof EXAM_DUTY_CATEGORIES)[number])) {
      return { created: 0, skipped: 0, skippedItems: [], gpt_errors: 0 };
    }

    const skippedItems: ExamDutySkippedItem[] = [];
    const addSkipped = (title: string, linkUrl: string, reason: string) => {
      skippedItems.push({
        source_key: source.key,
        source_label: source.label,
        title: title.slice(0, 512),
        url: linkUrl.slice(0, 1024),
        reason,
      });
    };

    const existingIds = new Set(
      (await this.dutyRepo
        .createQueryBuilder('e')
        .select('e.externalId')
        .where('e.source_key = :key', { key: source.key })
        .andWhere('e.deleted_at IS NULL')
        .getMany())
        .map((d) => d.externalId)
        .filter((id): id is string => !!id),
    );

    const rssTimes = await this.appConfig.getExamDutyDefaultTimes();
    const applyTime = (d: Date | null, key: keyof typeof rssTimes): Date | null => {
      if (!d) return null;
      const [h, m] = (rssTimes[key] ?? '00:00').split(':').map((x) => parseInt(x, 10) || 0);
      const out = new Date(d);
      out.setHours(h, m, 0, 0);
      return out;
    };

    let created = 0;
    let skipped = 0;
    let gptErrorsRss = 0;

    for (const entry of entries.filter(Boolean)) {
      const e = entry as Record<string, unknown>;
      const title = extractText(e.title ?? e['title']);
      if (!title) continue;

      let link = extractLink(e, source.baseUrl ?? source.rssUrl);
      if (!link && e.link) {
        const l = e.link;
        if (typeof l === 'string') link = l;
        else if (l && typeof l === 'object' && 'href' in l) link = String((l as { href?: string }).href ?? '');
      }
      if (!link) continue;

      if (!matchesKeywords(title, source.titleKeywords)) {
        skipped++;
        addSkipped(title, link, 'Anahtar kelime eşleşmedi');
        continue;
      }

      const externalId = normalizeExternalId(link);
      if (existingIds.has(externalId)) {
        skipped++;
        addSkipped(title, link, 'Zaten mevcut');
        continue;
      }
      existingIds.add(externalId);

      const rawDesc = extractText(e.description ?? e.summary ?? e.content ?? e['content:encoded']);
      const pubDate = parseRssDate(e.pubDate ?? e.published ?? e.updated ?? e['dc:date']);
      let parsed: { application_end?: Date; exam_date?: Date; exam_date_end?: Date } = {};
      let categorySlug = source.categorySlug;

      const gptEnabled = await this.appConfig.isExamDutyGptEnabled();
      if (gptEnabled && (await this.gptService.isAvailable()) && rawDesc) {
        const cleanedDesc = this.preprocessBodyForGpt(rawDesc);
        const gptResponse = await this.gptService.extractFromText(
          { title, body: cleanedDesc, sourceUrl: link, fallbackStartDate: pubDate?.toISOString().slice(0, 10) },
          true,
        );
        if (gptResponse.gptError) gptErrorsRss++;
        const gptResult = gptResponse.result ?? null;
        if (gptResult) {
          if (!gptResult.is_application_announcement) {
            skipped++;
            addSkipped(title, link, 'GPT: Başvuru duyurusu değil');
            continue;
          }
          if (/ek\s*gelir\s*getiriyor|haftada\s*(bin\s*)?\d[\d.]*\s*tl/i.test(title)) {
            skipped++;
            addSkipped(title, link, 'Sadece ek gelir/ücret haberi; başvuru duyurusu değil');
            continue;
          }
          const hasGptDates =
            !!(gptResult.son_basvuru || gptResult.sinav_1_gunu || gptResult.sinav_2_gunu);
          if (
            hasGptDates === false &&
            this.isLikelyNonApplication(title)
          ) {
            skipped++;
            addSkipped(title, link, 'Sadece ücret haberi; başvuru/sınav tarihi yok');
            continue;
          }
          categorySlug = this.resolveExamDutyCategorySlug({
            body: rawDesc,
            sourceHref: link,
            gptCategory: gptResult.category_slug,
            title,
            fallbackSlug: source.categorySlug,
            mode: 'rss',
          });
          if (gptResult.son_basvuru) parsed.application_end = new Date(gptResult.son_basvuru);
          if (gptResult.sinav_1_gunu) parsed.exam_date = new Date(gptResult.sinav_1_gunu);
          if (gptResult.sinav_2_gunu) parsed.exam_date_end = new Date(gptResult.sinav_2_gunu);
        }
      }
      const applicationUrl = getApplicationUrlForCategory(categorySlug);

      let rssExamDate = applyTime(parsed.exam_date ?? null, 'exam_date');
      let rssExamDateEnd = applyTime(parsed.exam_date_end ?? null, 'exam_date_end');
      if (rssExamDate && rssExamDateEnd && rssExamDate.getTime() > rssExamDateEnd.getTime()) {
        [rssExamDate, rssExamDateEnd] = [rssExamDateEnd, rssExamDate];
      }

      const { summary: dutySummary, body: dutyBody } = this.buildShortSummaryAndBody(
        rawDesc,
        title,
        parsed.application_end ?? null,
        parsed.exam_date ?? null,
        applicationUrl,
      );

      const dupByUrl = await this.dutyRepo.findOne({
        where: { sourceUrl: link, deletedAt: IsNull() },
      });
      if (dupByUrl) {
        skipped++;
        addSkipped(title, link, 'Aynı kaynak URL başka duyuruda mevcut');
        continue;
      }

      if (quota && quota.remaining <= 0) {
        skipped++;
        addSkipped(title, link, 'Sync kotası doldu (max yeni duyuru)');
        continue;
      }
      if (quota) quota.remaining--;

      const duty = this.dutyRepo.create({
        title: formatExamDutySyncTitle(categorySlug, title).slice(0, 512),
        categorySlug,
        summary: dutySummary,
        body: dutyBody,
        sourceUrl: link,
        applicationUrl,
        sourceKey: source.key,
        externalId,
        applicationStart: new Date(),
        applicationEnd: applyTime(parsed.application_end ?? null, 'application_end'),
        examDate: rssExamDate,
        examDateEnd: rssExamDateEnd,
        status: 'draft',
      });

      if (!dryRun) await this.dutyRepo.save(duty);
      created++;
    }

    return { created, skipped, skippedItems, gpt_errors: gptErrorsRss };
  }

  private async syncFromScrape(source: ExamDutySyncSource, recheckDuties: ExamDuty[] = [], options: { timeoutMs: number; skipPastExamDate: boolean; addDraftWithoutDates: boolean; quota: { remaining: number }; dryRun?: boolean }): Promise<{
    created: number;
    restored: number;
    skipped: number;
    skippedItems: ExamDutySkippedItem[];
    gpt_errors: number;
    lastProcessedUrl?: string | null;
  }> {
    const lastProcessedUrl = (source as ExamDutySyncSource & { lastProcessedUrl?: string | null }).lastProcessedUrl?.trim() || null;
    const config = source.scrapeConfig as {
      list_url?: string;
      list_urls?: string[];
      container_selector?: string;
      item_selector?: string;
      link_selector?: string;
      title_selector?: string;
      date_selector?: string;
      base_url_override?: string | null;
      detect_category_per_item?: boolean;
      filter_non_application?: boolean;
      /** Tek konulu sayfa (örn. /haberler/sinav-gorevi/) – title_keywords atlanır */
      skip_title_keywords?: boolean;
      /** Her haberin detay sayfasını çek, body'den tarih/başvuru URL çıkar */
      fetch_article_for_dates?: boolean;
      /** Detay sayfasında içerik seçicisi (virgülle ayrılmış, ilk eşleşen) */
      article_body_selector?: string;
      /** Sayfadaki slayt/carousel alanı – bu bloktan en fazla slider_item_limit (varsayılan 15) haber adayı alınır */
      slider_selector?: string;
      /** Slayt içinde öğe seçicisi (boşsa item_selector kullanılır) */
      slider_item_selector?: string;
      /** Slayttan alınacak azami haber sayısı (varsayılan 15) */
      slider_item_limit?: number;
      /** Her sync'te işlenecek azami yeni aday sayısı (sırayla 1'er; 0=sınırsız) */
      max_process_per_sync?: number;
    } | null;

    const SLIDER_ITEM_LIMIT = Math.min(config?.slider_item_limit ?? 15, 15);
    const maxProcessPerSync = config?.max_process_per_sync ?? 0;

    const listUrl = config?.list_url ?? config?.list_urls?.[0];
    if (!listUrl) throw new Error('scrape_config.list_url veya list_urls tanımlı değil');

    const base = (config?.base_url_override ?? source.baseUrl ?? '').replace(/\/$/, '');
    const fullUrl = listUrl.startsWith('http') ? listUrl : `${base}${listUrl.startsWith('/') ? '' : '/'}${listUrl}`;

    const res = await fetchWithRetry(
      fullUrl,
      { headers: { 'User-Agent': USER_AGENT, Accept: 'text/html; charset=utf-8, */*' } },
      FETCH_RETRIES,
      options.timeoutMs,
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const buffer = await res.arrayBuffer();
    const html = this.decodeHtmlWithCharset(Buffer.from(buffer), res.headers.get('content-type'));
    const $ = cheerio.load(html);
    // Güncel Eğitim: container_selector boşsa tüm sayfa taranır (~45 aday, 35 yeni eklenir).
    // Sadece slayt (#headline) takip edilsin diye boşsa varsayılan #headline uygula.
    let containerSelectorRaw = config?.container_selector ?? '';
    if (source.key === 'exam_duty_guncelegitim' && !containerSelectorRaw.trim()) {
      containerSelectorRaw = 'main';
      this.logger.warn(`[${source.key}] container_selector boştu; varsayılan main uygulandı (sınav görevi listesi).`);
    }
    const containerSelectors = containerSelectorRaw
      ? containerSelectorRaw.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    const itemSelector = config?.item_selector ?? 'a[href*="/haber/"]';
    const linkSelector = config?.link_selector ?? 'a';
    const titleSelector = config?.title_selector ?? 'a';
    const dateSelector = config?.date_selector ?? '';

    const candidates: { title: string; href: string; dateStr: string; preloadedBody?: string }[] = [];
    const seenHref = new Set<string>();

    const sliderSelector = config?.slider_selector?.trim();
    const containerItemLimit =
      maxProcessPerSync > 0
        ? undefined
        : containerSelectors.length > 0 && !sliderSelector
          ? Math.min(config?.slider_item_limit ?? 15, 15)
          : undefined;

    const collectFromScope = ($scope: ReturnType<typeof $>, limit?: number) => {
      let added = 0;
      const $items = $scope?.length ? $scope.find(itemSelector) : $(itemSelector);
      $items.each((_, el) => {
        if (limit != null && added >= limit) return false;
        const $el = $(el);
        const $link = $el.is('a') ? $el : $el.find(linkSelector).first();
        if ($link.length === 0) return;
        let href = $link.attr('href') ?? '';
        if (!href) return;
        if (href.startsWith('/')) href = `${base}${href}`;
        else if (!href.startsWith('http')) href = `${base}/${href}`;
        const norm = normalizeExternalId(href);
        if (seenHref.has(norm)) return;
        seenHref.add(norm);

        const $titleEl = titleSelector && !$el.is(linkSelector) ? $el.find(titleSelector).first() : $link;
        let title = ($titleEl.length ? $titleEl : $link).text().trim();
        title = title.replace(/^SINAV GÖREVİ\s*/i, '').trim() || title;
        if (!title) return;

        let dateStr = '';
        if (dateSelector) dateStr = $el.find(dateSelector).first().text().trim();
        candidates.push({ title, href, dateStr });
        added++;
      });
    };

    if (containerSelectors.length > 0) {
      for (const sel of containerSelectors) {
        const $scope = $(sel);
        if (!$scope.length) this.logger.warn(`[${source.key}] container_selector "${sel}" bulunamadı`);
        else collectFromScope($scope, containerItemLimit);
      }
    } else {
      collectFromScope($.root());
    }

    // Sayfada slayt/carousel varsa bu bloktan en fazla 15 haber içeriği de aday listesine eklenir.
    if (sliderSelector) {
      const $slider = $(sliderSelector);
      if ($slider.length) {
        const sliderItemSel = config?.slider_item_selector?.trim() || itemSelector;
        const $sliderItems = $slider.find(sliderItemSel);
        let addedFromSlider = 0;
        $sliderItems.each((_, el) => {
          if (addedFromSlider >= SLIDER_ITEM_LIMIT) return false;
          const $el = $(el);
          const $link = $el.is('a') ? $el : $el.find(linkSelector).first();
          if ($link.length === 0) return;
          let href = $link.attr('href') ?? '';
          if (!href) return;
          if (href.startsWith('/')) href = `${base}${href}`;
          else if (!href.startsWith('http')) href = `${base}/${href}`;
          const norm = normalizeExternalId(href);
          if (seenHref.has(norm)) return;
          seenHref.add(norm);

          const $titleEl = titleSelector && !$el.is(linkSelector) ? $el.find(titleSelector).first() : $link;
          let title = ($titleEl.length ? $titleEl : $link).text().trim();
          title = title.replace(/^SINAV GÖREVİ\s*/i, '').trim() || title;
          if (!title) return;

          let dateStr = '';
          if (dateSelector) dateStr = $el.find(dateSelector).first().text().trim();
          candidates.push({ title, href, dateStr });
          addedFromSlider++;
        });
        if (addedFromSlider > 0)
          this.logger.log(`[${source.key}] Slayt: ${addedFromSlider} haber adayı eklendi (max ${SLIDER_ITEM_LIMIT})`);
      } else {
        this.logger.warn(`[${source.key}] slider_selector "${sliderSelector}" bulunamadı`);
      }
    }

    // Silinen duyuruları tekrar kontrol et: recheck adayları ekle (aynı kaynaksa).
    const bodySelectors =
      config?.article_body_selector ??
      'article, .post-content, .content, .entry-content, main, .haber-detay, .haber-content';
    for (const recheckDuty of recheckDuties) {
      if (recheckDuty.sourceKey !== source.key || !recheckDuty.sourceUrl?.trim()) continue;
      const recheckUrl = recheckDuty.sourceUrl.trim();
      const normRecheck = normalizeExternalId(recheckUrl);
      if (seenHref.has(normRecheck)) continue;
      seenHref.add(normRecheck);
      const preloadedBody = await this.fetchArticleBody(recheckUrl, bodySelectors, options.timeoutMs);
      candidates.push({
        title: recheckDuty.title,
        href: recheckUrl,
        dateStr: '',
        preloadedBody: preloadedBody ?? undefined,
      });
      this.logger.log(`[${source.key}] Recheck: silinen duyuru linki eklendi (${recheckUrl.slice(0, 60)}…)`);
    }

    const detectCategoryPerItem = config?.detect_category_per_item === true;
    const filterNonApplication = config?.filter_non_application !== false;
    const defaultCategory = EXAM_DUTY_CATEGORIES.includes(source.categorySlug as (typeof EXAM_DUTY_CATEGORIES)[number])
      ? source.categorySlug
      : 'meb';
    const gptEnabled = await this.appConfig.isExamDutyGptEnabled();
    const gptAvailable = await this.gptService.isAvailable();
    const scrapeTimes = await this.appConfig.getExamDutyDefaultTimes();

    const existingRows = await this.dutyRepo
      .createQueryBuilder('e')
      .select('e.externalId')
      .where('e.source_key = :key', { key: source.key })
      .andWhere('e.deleted_at IS NULL')
      .getMany();
    const existingIds = new Set(
      existingRows.map((d) => d.externalId).filter((id): id is string => !!id),
    );
    this.logger.log(`[${source.key}] Scrape: ${candidates.length} aday, ${existingIds.size} mevcut kayıt`);

    const skipTitleKeywords = config?.skip_title_keywords === true;
    let created = 0;
    let restored = 0;
    let skipped = 0;
    let skippedKeywords = 0;
    let skippedExisting = 0;
    let skippedGpt = 0;
    let skippedRule = 0;
    let gptErrorsScrape = 0;
    const seen = new Set<string>();
    const skippedItems: ExamDutySkippedItem[] = [];
    const addSkipped = (title: string, hrefUrl: string, reason: string) => {
      skippedItems.push({
        source_key: source.key,
        source_label: source.label,
        title: title.slice(0, 512),
        url: hrefUrl.slice(0, 1024),
        reason,
      });
    };

    const normLastProcessed = lastProcessedUrl ? normalizeExternalId(lastProcessedUrl) : null;
    const lastProcessedInList = normLastProcessed && candidates.some((c) => normalizeExternalId(c.href) === normLastProcessed);
    let passedLastProcessed = !normLastProcessed || !lastProcessedInList;
    let processedCount = 0;
    let processedUrl: string | null = null;

    for (const c of candidates) {
      const normHref = normalizeExternalId(c.href);
      if (seen.has(normHref)) continue;
      seen.add(normHref);

      if (maxProcessPerSync > 0 && normLastProcessed) {
        if (!passedLastProcessed) {
          if (normHref === normLastProcessed) passedLastProcessed = true;
          continue;
        }
      }

      if (!skipTitleKeywords && !matchesKeywords(c.title, source.titleKeywords)) {
        skipped++;
        skippedKeywords++;
        addSkipped(c.title, c.href, 'Anahtar kelime eşleşmedi');
        continue;
      }

      if (existingIds.has(normHref)) {
        skipped++;
        skippedExisting++;
        addSkipped(c.title, c.href, 'Zaten mevcut');
        continue;
      }

      if (options.quota.remaining <= 0) {
        break;
      }

      if (maxProcessPerSync > 0 && processedCount >= maxProcessPerSync) break;
      processedCount++;

      let categorySlug = defaultCategory;

      let bodyText: string | null = c.preloadedBody ?? null;
      const fetchArticle = config?.fetch_article_for_dates === true;
      if (!bodyText && fetchArticle) {
        const bodySelectors =
          config?.article_body_selector ??
          'article, .post-content, .content, .entry-content, main, .haber-detay, .haber-content';
        bodyText = await this.fetchArticleBody(c.href, bodySelectors, options.timeoutMs);
        if (!bodyText) {
          skipped++;
          addSkipped(c.title, c.href, 'Link erişilemedi veya içerik alınamadı');
          continue;
        }
        await new Promise((r) => setTimeout(r, 150));
      }

      let gptResult: ExamDutyExtractResult | null = null;
      const hasBody = !!(bodyText?.trim());
      if (hasBody && gptEnabled && gptAvailable) {
        await new Promise((r) => setTimeout(r, GPT_DELAY_MS));
        const cleanedBody = this.preprocessBodyForGpt(bodyText!);
        const gptResponse = await this.gptService.extractFromText(
          {
            title: c.title,
            body: cleanedBody,
            sourceUrl: c.href,
            fallbackStartDate: c.dateStr || null,
          },
          true,
        );
        if (gptResponse.gptError) gptErrorsScrape++;
        gptResult = gptResponse.result ?? null;
      }

      if (filterNonApplication) {
        const bodySuggestsApp = bodyText ? this.bodySuggestsApplication(bodyText) : false;
        const bodyFeeOnly = bodyText
          ? this.bodyLooksLikeFeeInfoOnly(bodyText, bodySuggestsApp)
          : false;
        const isExamAnnouncement = this.bodyOrTitleSuggestsExamAnnouncement(
          bodyText ?? null,
          c.title,
        );

        if (gptResult) {
          /** GPT false dediyse metin "sınav tarihi" geçse bile başvuru duyurusu sayma (olay haberi yanlış pozitif). */
          const treatAsApplication =
            gptResult.is_application_announcement ||
            (gptResult.is_application_announcement !== false && bodySuggestsApp && hasBody);
          const hasAnyDate =
            !!(gptResult.son_basvuru || gptResult.sinav_1_gunu || gptResult.sinav_2_gunu);
          if (
            !isExamAnnouncement &&
            !treatAsApplication
          ) {
            skipped++;
            skippedGpt++;
            addSkipped(
              c.title,
              c.href,
              'GPT: Başvuru duyurusu değil',
            );
            continue;
          }
          if (treatAsApplication && !hasAnyDate && !options.addDraftWithoutDates) {
            skipped++;
            skippedGpt++;
            addSkipped(
              c.title,
              c.href,
              'GPT: İçerikte sınav tarihi veya başvuru tarihi bulunamadı (tam metin kontrol edildi)',
            );
            continue;
          }
          if (treatAsApplication && !hasAnyDate && options.addDraftWithoutDates) {
            this.logger.log(`[${source.key}] Tarihsiz başvuru duyurusu taslak olarak eklenecek: ${c.title.slice(0, 50)}…`);
          }
        } else if (
          !isExamAnnouncement &&
          (bodyFeeOnly || (!bodySuggestsApp && this.isLikelyNonApplication(c.title)))
        ) {
          skipped++;
          skippedRule++;
          addSkipped(
            c.title,
            c.href,
            bodyFeeOnly ? 'İçerik sadece ücret bilgisi' : 'Başvuru duyurusu değil (başlık/içerik)',
          );
          continue;
        }
      }

      const externalId = normHref;
      existingIds.add(externalId);

      const fallbackDates = bodyText ? this.parseDatesFromBodyFallback(bodyText) : null;
      const useGptForDates = gptEnabled && gptAvailable && gptResult;

      const parseGptDate = (dateStr: string | null | undefined): { date: Date | null, hasTime: boolean } => {
        if (!dateStr) return { date: null, hasTime: false };
        const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2}))?/);
        if (!m) return { date: null, hasTime: false };
        const y = parseInt(m[1], 10), mo = parseInt(m[2], 10) - 1, d = parseInt(m[3], 10);
        if (y < 2024 || y > 2030) return { date: null, hasTime: false };
        if (m[4] && m[5]) {
          return { date: new Date(y, mo, d, parseInt(m[4], 10), parseInt(m[5], 10)), hasTime: true };
        }
        return { date: new Date(y, mo, d), hasTime: false };
      };

      const gptSonBasvuru = parseGptDate(gptResult?.son_basvuru);
      const gptSinav1 = parseGptDate(gptResult?.sinav_1_gunu);
      const gptSinav2 = parseGptDate(gptResult?.sinav_2_gunu);
      /** GPT çıktısında sınav alanları boş string ise regex fallback ile sınav üretme (yayın/yanlış eşleşme riski). */
      const gptHasExamStrings = !!(gptResult?.sinav_1_gunu?.trim() || gptResult?.sinav_2_gunu?.trim());

      let applicationStart: Date | null = new Date();
      let applicationEnd: Date | null = useGptForDates && gptSonBasvuru.date ? gptSonBasvuru.date : (fallbackDates?.application_end ?? null);
      let applicationApprovalEnd: Date | null = null;
      let resultDate: Date | null = null;
      let examDate: Date | null;
      let examDateEnd: Date | null;
      if (useGptForDates && gptResult) {
        if (gptHasExamStrings) {
          examDate = gptSinav1.date;
          examDateEnd = gptSinav2.date ?? gptSinav1.date;
        } else {
          examDate = null;
          examDateEnd = null;
        }
      } else {
        examDate = fallbackDates?.exam_date ?? null;
        examDateEnd = fallbackDates?.exam_date_end ?? null;
      }

      const appStartHasTime = true;
      let appEndHasTime = useGptForDates ? gptSonBasvuru.hasTime : false;
      let appApprovalHasTime = false;
      let resultHasTime = false;
      let examHasTime = useGptForDates ? gptSinav1.hasTime : false;
      let examEndHasTime = useGptForDates ? (gptSinav2.hasTime ?? gptSinav1.hasTime) : false;

      if (examDate && !examDateEnd) examDateEnd = examDate;
      if (examDateEnd && !examDate) examDate = examDateEnd;
      if (examDate && examDateEnd && examDate.getTime() > examDateEnd.getTime())
        [examDate, examDateEnd] = [examDateEnd, examDate];

      categorySlug = this.resolveExamDutyCategorySlug({
        body: bodyText,
        sourceHref: c.href,
        gptCategory: gptResult?.category_slug ?? null,
        title: c.title,
        fallbackSlug: defaultCategory,
        detectPerItem: detectCategoryPerItem,
        mode: 'scrape',
      });
      const applicationUrl = getApplicationUrlForCategory(categorySlug);

      if (!applicationApprovalEnd && applicationEnd) {
        const d = new Date(applicationEnd);
        d.setDate(d.getDate() + 1);
        applicationApprovalEnd = d;
      }

      const applyScrapeTime = (d: Date | null, key: keyof typeof scrapeTimes, hasTime: boolean): Date | null => {
        if (!d) return null;
        if (hasTime) return d;
        const [h, m] = (scrapeTimes[key] ?? '00:00').split(':').map((x) => parseInt(x, 10) || 0);
        const out = new Date(d);
        out.setHours(h, m, 0, 0);
        return out;
      };
      applicationStart = applyScrapeTime(applicationStart, 'application_start', appStartHasTime);
      applicationEnd = applyScrapeTime(applicationEnd, 'application_end', appEndHasTime);
      applicationApprovalEnd = applyScrapeTime(applicationApprovalEnd, 'application_approval_end', appApprovalHasTime);
      examDate = applyScrapeTime(examDate, 'exam_date', examHasTime);
      examDateEnd = applyScrapeTime(examDateEnd, 'exam_date_end', examEndHasTime);

      const dateValidationStatus: DateValidationStatus | null = gptResult?.is_application_announcement ? 'validated' : null;
      const dateValidationIssues: string | null = null;

      // Geçmiş sınav tarihi atlama (config: skip_past_exam_date)
      if (options.skipPastExamDate && (examDate ?? examDateEnd)) {
        const todayTurkey = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
        const lastExam = examDateEnd ?? examDate!;
        const lastStr = lastExam.toISOString().slice(0, 10);
        if (lastStr < todayTurkey) {
          skipped++;
          addSkipped(c.title, c.href, 'Sınav tarihi geçmiş');
          continue;
        }
      }

      const { summary: dutySummary, body: dutyBody } = this.buildSummaryAndBody(
        bodyText,
        c.title,
        applicationEnd,
        examDate,
        applicationUrl ?? null,
      );

      const existingDuty = await this.dutyRepo.findOne({
        where: { externalId, sourceKey: source.key },
      });
      if (existingDuty) {
        if (existingDuty.deletedAt) {
          if (options.quota.remaining <= 0) {
            skipped++;
            addSkipped(c.title, c.href, 'Sync kotası doldu (max yeni duyuru)');
            continue;
          }
          options.quota.remaining--;
          existingDuty.deletedAt = null;
          existingDuty.title = formatExamDutySyncTitle(categorySlug, c.title).slice(0, 512);
          existingDuty.categorySlug = categorySlug;
          existingDuty.summary = dutySummary;
          existingDuty.body = dutyBody;
          existingDuty.sourceUrl = c.href;
          existingDuty.applicationUrl = applicationUrl;
          existingDuty.applicationStart = new Date();
          existingDuty.applicationEnd = applicationEnd ?? null;
          existingDuty.applicationApprovalEnd = applicationApprovalEnd ?? null;
          existingDuty.resultDate = resultDate ?? null;
          existingDuty.examDate = examDate ?? null;
          existingDuty.examDateEnd = examDateEnd ?? null;
          existingDuty.status = 'draft';
          existingDuty.dateValidationStatus = dateValidationStatus ?? null;
          existingDuty.dateValidationIssues = dateValidationIssues ?? null;
          if (!options.dryRun) await this.dutyRepo.save(existingDuty);
          restored++;
          existingIds.add(externalId);
          processedUrl = c.href;
        } else {
          skipped++;
          skippedExisting++;
          addSkipped(c.title, c.href, 'Zaten mevcut');
        }
        continue;
      }

      const dupByUrl = await this.dutyRepo.findOne({
        where: { sourceUrl: c.href, deletedAt: IsNull() },
      });
      if (dupByUrl) {
        skipped++;
        addSkipped(c.title, c.href, 'Aynı kaynak URL başka duyuruda mevcut');
        continue;
      }

      if (options.quota.remaining <= 0) {
        skipped++;
        addSkipped(c.title, c.href, 'Sync kotası doldu (max yeni duyuru)');
        continue;
      }
      options.quota.remaining--;

      const duty = this.dutyRepo.create({
        title: formatExamDutySyncTitle(categorySlug, c.title).slice(0, 512),
        categorySlug,
        summary: dutySummary,
        body: dutyBody,
        sourceUrl: c.href,
        applicationUrl,
        sourceKey: source.key,
        externalId,
        applicationStart,
        applicationEnd,
        applicationApprovalEnd,
        resultDate,
        examDate,
        examDateEnd,
        status: 'draft',
        dateValidationStatus,
        dateValidationIssues,
      });
      if (!options.dryRun) await this.dutyRepo.save(duty);
      created++;
      processedUrl = c.href;
    }
    if (candidates.length > 0 && created === 0 && restored === 0) {
      this.logger.warn(
        `[${source.key}] 0 eklendi: aday=${candidates.length}, keyword=${skippedKeywords}, mevcut=${skippedExisting}, gpt_no=${skippedGpt}, kural_no=${skippedRule}`,
      );
    }
    if (restored > 0) {
      this.logger.log(`[${source.key}] ${restored} silinen duyuru sync ile geri yüklendi`);
    }
    const finalProcessedUrl =
      processedUrl ?? (maxProcessPerSync > 0 && processedCount === 0 && lastProcessedUrl ? null : undefined);
    return {
      created,
      restored,
      skipped,
      skippedItems,
      gpt_errors: gptErrorsScrape,
      lastProcessedUrl: finalProcessedUrl,
    };
  }

  private parseTrDate(str: string): Date | null {
    const m = str.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
    if (m) {
      const [, d, month, y] = m;
      const year = parseInt(y!, 10) < 100 ? 2000 + parseInt(y!, 10) : parseInt(y!, 10);
      const date = new Date(year, parseInt(month!, 10) - 1, parseInt(d!, 10));
      return isNaN(date.getTime()) ? null : date;
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }

  /** Haber detay sayfasından içerik metnini çıkar */
  private async fetchArticleBody(url: string, selectors: string, timeoutMs: number = FETCH_TIMEOUT_MS): Promise<string | null> {
    try {
      const res = await fetchWithRetry(
        url,
        { headers: { 'User-Agent': USER_AGENT, Accept: 'text/html; charset=utf-8, */*' } },
        FETCH_RETRIES,
        timeoutMs,
      );
      if (!res.ok) return null;
      const buffer = await res.arrayBuffer();
      const html = this.decodeHtmlWithCharset(Buffer.from(buffer), res.headers.get('content-type'));
      const $ = cheerio.load(html);
      const parts = selectors.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
      for (const sel of parts) {
        const $el = $(sel).first();
        if ($el.length) {
          const txt = $el.text().trim();
          if (txt.length >= 80) return txt;
        }
      }
    } catch {
      // ignore
    }
    return null;
  }

  /** Body'den tarih çıkar (GPT null döndüğünde fallback). Başvuru: DD.MM.YYYY - DD.MM.YYYY, Sınav Tarihi : DD.MM.YYYY, Son gün: DD Ay YYYY */
  private parseDatesFromBodyFallback(body: string): {
    application_start?: Date | null;
    application_end?: Date | null;
    exam_date?: Date | null;
    exam_date_end?: Date | null;
  } | null {
    const toDate = (d: number, m: number, y: number): Date | null => {
      const yr = y < 100 ? 2000 + y : y;
      if (yr < 2024 || yr > 2030) return null;
      const dt = new Date(yr, m - 1, d);
      return isNaN(dt.getTime()) ? null : dt;
    };
    const months: Record<string, number> = {
      ocak: 1, şubat: 2, mart: 3, nisan: 4, mayıs: 5, haziran: 6,
      temmuz: 7, ağustos: 8, eylül: 9, ekim: 10, kasım: 11, aralık: 12,
    };
    const out: { application_start?: Date; application_end?: Date; exam_date?: Date; exam_date_end?: Date } = {};
    const norm = body.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    const basvuruMatch = norm.match(/başvuru\s*:\s*(\d{1,2})[.\/\-](\d{1,2})[.\/\-](\d{2,4})\s+(?:\d{1,2}:\d{2}\s*)?[-–]\s*(\d{1,2})[.\/\-](\d{1,2})[.\/\-](\d{2,4})/i);
    if (basvuruMatch) {
      const [, d1, m1, y1, d2, m2, y2] = basvuruMatch.map((x) => parseInt(x, 10));
      const start = toDate(d1, m1, y1);
      const end = toDate(d2, m2, y2);
      if (start) out.application_start = start;
      if (end) out.application_end = end;
    }

    const sonIstekMatch = norm.match(/son\s*istek\s*zamanı\s*:\s*(\d{1,2})\s+(ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık)\s+(\d{2,4})/i);
    if (sonIstekMatch && !out.application_end) {
      const [, dStr, monthName, yStr] = sonIstekMatch;
      const d = parseInt(dStr!, 10);
      const m = months[monthName!.toLowerCase()] ?? 0;
      const y = parseInt(yStr!, 10);
      if (m && d && y) {
        const dt = toDate(d, m, y);
        if (dt) out.application_end = dt;
      }
    }

    const sonBasvuruTarihiMatch = norm.match(/son\s*başvuru\s*(?:tarihi|günü)?\s*(?:ve\s*saati?)?\s*:\s*(\d{1,2})[.\/\-](\d{1,2})[.\/\-](\d{2,4})/i);
    if (sonBasvuruTarihiMatch && !out.application_end) {
      const [, d, m, y] = sonBasvuruTarihiMatch.map((x) => parseInt(x, 10));
      const dt = toDate(d, m, y);
      if (dt) out.application_end = dt;
    }

    const sonBasvuruTarihiAyMatch = norm.match(/son\s*başvuru\s*(?:tarihi|günü)?\s*(?:ve\s*saati?)?\s*:\s*(\d{1,2})\s+(ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık)\s+(\d{2,4})/i);
    if (sonBasvuruTarihiAyMatch && !out.application_end) {
      const [, dStr, monthName, yStr] = sonBasvuruTarihiAyMatch;
      const d = parseInt(dStr!, 10);
      const m = months[monthName!.toLowerCase()] ?? 0;
      const y = parseInt(yStr!, 10);
      if (m && d && y) {
        const dt = toDate(d, m, y);
        if (dt) out.application_end = dt;
      }
    }

    const sonBasvuruAyMatch = norm.match(/(?:son\s*başvuru\s*günü|başvuruların\s*\d+\s*\w+\s*tarihine\s*kadar)\s*:\s*(\d{1,2})\s+(ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık)\s+(\d{2,4})/i);
    if (sonBasvuruAyMatch && !out.application_end) {
      const [, dStr, monthName, yStr] = sonBasvuruAyMatch;
      const d = parseInt(dStr!, 10);
      const m = months[monthName!.toLowerCase()] ?? 0;
      const y = parseInt(yStr!, 10);
      if (m && d && y) {
        const dt = toDate(d, m, y);
        if (dt) out.application_end = dt;
      }
    }

    const sonGunMatch = norm.match(/son\s*gün\s*:\s*(\d{1,2})\s+(ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık)\s+(\d{2,4})/i);
    if (sonGunMatch && !out.application_end) {
      const [, dStr, monthName, yStr] = sonGunMatch;
      const d = parseInt(dStr!, 10);
      const m = months[monthName!.toLowerCase()] ?? 0;
      const y = parseInt(yStr!, 10);
      if (m && d && y) {
        const dt = toDate(d, m, y);
        if (dt) out.application_end = dt;
      }
    }

    const sonIstekZamaniTabloMatch = norm.match(/son\s*istek\s*zamanı\s*:\s*(\d{1,2})[.\/\-](\d{1,2})[.\/\-](\d{2,4})/i);
    if (sonIstekZamaniTabloMatch && !out.application_end) {
      const [, d, m, y] = sonIstekZamaniTabloMatch.map((x) => parseInt(x, 10));
      const dt = toDate(d, m, y);
      if (dt) out.application_end = dt;
    }

    const sinavMatch = norm.match(/sınav\s*tarihi\s*[:\s]+(\d{1,2})[.\/\-](\d{1,2})[.\/\-](\d{2,4})/i);
    if (sinavMatch) {
      const [, d, m, y] = sinavMatch.map((x) => parseInt(x, 10));
      const dt = toDate(d, m, y);
      if (dt) {
        out.exam_date = dt;
        out.exam_date_end = dt;
      }
    }

    const sinavRangeMatch = norm.match(/sınav\s*(?:tarihi|günleri?)?\s*[:\s]+(\d{1,2})[.\/\-](\d{1,2})[.\/\-](\d{2,4})\s*[-–]\s*(\d{1,2})[.\/\-](\d{1,2})[.\/\-](\d{2,4})/i);
    if (sinavRangeMatch && !out.exam_date) {
      const [, d1, m1, y1, d2, m2, y2] = sinavRangeMatch.map((x) => parseInt(x, 10));
      const start = toDate(d1, m1, y1);
      const end = toDate(d2, m2, y2);
      if (start) out.exam_date = start;
      if (end) out.exam_date_end = end;
    }

    const sinavAyMatch = norm.match(/(\d{1,2})\s*[-–]\s*(\d{1,2})\s+(ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık)\s+(\d{2,4})/i);
    if (sinavAyMatch && !out.exam_date) {
      const [, d1Str, d2Str, monthName, yStr] = sinavAyMatch;
      const d1 = parseInt(d1Str!, 10);
      const d2 = parseInt(d2Str!, 10);
      const m = months[monthName!.toLowerCase()] ?? 0;
      const y = parseInt(yStr!, 10);
      if (m && d1 && d2 && y) {
        const start = toDate(d1, m, y);
        const end = toDate(d2, m, y);
        if (start) out.exam_date = start;
        if (end) out.exam_date_end = end;
      }
    }

    const tarihlerindeMatch = norm.match(/(\d{1,2})\s*[-–]\s*(\d{1,2})\s+(ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık)\s+(\d{2,4})\s+tarihlerinde/i);
    if (tarihlerindeMatch && !out.exam_date) {
      const [, d1Str, d2Str, monthName, yStr] = tarihlerindeMatch;
      const d1 = parseInt(d1Str!, 10);
      const d2 = parseInt(d2Str!, 10);
      const m = months[monthName!.toLowerCase()] ?? 0;
      const y = parseInt(yStr!, 10);
      if (m && d1 && d2 && y) {
        const start = toDate(d1, m, y);
        const end = toDate(d2, m, y);
        if (start) out.exam_date = start;
        if (end) out.exam_date_end = end;
      }
    }

    const sonIstekDDMMMatch = norm.match(/son\s*istek\s*zamanı\s*:\s*(\d{1,2})[.\/\-](\d{1,2})[.\/\-](\d{2,4})/i);
    if (sonIstekDDMMMatch && !out.application_end) {
      const [, d, m, y] = sonIstekDDMMMatch.map((x) => parseInt(String(x), 10));
      const dt = toDate(d, m, y);
      if (dt) out.application_end = dt;
    }

    return Object.keys(out).length > 0 ? out : null;
  }

  /** GPT'ye göndermeden önce: güncelleme/yayın zamanı satırlarını kaldır (sınav/başvuru tarihi ile karışmasın). */
  private preprocessBodyForGpt(rawText: string): string {
    const lines = rawText.split(/\n/);
    const filtered: string[] = [];
    for (const line of lines) {
      const t = line.trim();
      if (/^güncelleme\s*:\s*\d{1,2}[.\/\-]\d{1,2}[.\/\-]\d{2,4}/i.test(t)) continue;
      if (/^sınav\s*günleri\s*ve\s*oturumlar\s*:\s*\d{1,2}[.\/\-]\d{1,2}[.\/\-]\d{2,4}\s+\d{1,2}:\d{2}\s*$/i.test(t)) continue;
      if (/^\d{1,2}[.\/\-]\d{1,2}[.\/\-]\d{2,4}\s+\d{1,2}:\d{2}\s*$/i.test(t)) continue;
      filtered.push(line);
    }
    return filtered.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  /** Kaynak metinden sınav günleri ve oturumları ile ilgili tüm bölümleri çıkarır (içerikte tam gösterilsin). */
  private extractExamDaysAndSessionsFromText(rawText: string): string {
    const normalized = rawText.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const datePattern = /\d{1,2}[.\/\-]\d{1,2}[.\/\-]\d{2,4}|\d{1,2}\s+(?:ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık)\s+\d{2,4}/i;
    const examKeyword = /sınav|oturum|gün|tarih/i;

    const lines = normalized.split(/\n/);
    const collected: string[] = [];
    let inExamBlock = false;
    let blockBuffer: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (!trimmed) {
        if (blockBuffer.length > 0) {
          collected.push(blockBuffer.join('\n'));
          blockBuffer = [];
        }
        inExamBlock = false;
        continue;
      }

      const hasDate = datePattern.test(trimmed);
      const hasKeyword = examKeyword.test(trimmed);
      const looksLikeHeading = /^(sınav\s*(tarihleri?|günleri)?|oturumlar?|tarih\s*\/\s*gün|gün\s*\/\s*tarih)/i.test(trimmed);

      if (looksLikeHeading || (hasDate && hasKeyword)) {
        inExamBlock = true;
      }
      if (inExamBlock && (hasDate || hasKeyword || blockBuffer.length > 0)) {
        blockBuffer.push(trimmed);
        if (!hasDate && !hasKeyword && blockBuffer.length > 5) {
          inExamBlock = false;
          collected.push(blockBuffer.join('\n'));
          blockBuffer = [];
        }
      } else if (hasDate && hasKeyword && !inExamBlock) {
        blockBuffer = [trimmed];
        inExamBlock = true;
      }
    }
    if (blockBuffer.length > 0) collected.push(blockBuffer.join('\n'));

    if (collected.length > 0) {
      return collected.join('\n\n').replace(/\n{3,}/g, '\n\n').slice(0, 8000);
    }

    const paragraphs = normalized.split(/\n\s*\n/);
    const relevant = paragraphs.filter((p) => {
      const t = p.replace(/\s+/g, ' ');
      return datePattern.test(t) && examKeyword.test(t);
    });
    return relevant.join('\n\n').replace(/\n{3,}/g, '\n\n').slice(0, 8000) || '';
  }

  /** Özet + sadece tablo formatında içerik (kaynak adı/URL eklenmez). */
  private buildShortSummaryAndBody(
    rawText: string | null,
    _title: string,
    applicationEnd: Date | null,
    examDate: Date | null,
    applicationUrl: string | null,
  ): { summary: string | null; body: string | null } {
    const fmt = (d: Date | null) => (d ? d.toLocaleDateString('tr-TR') : null);
    const parts: string[] = [];
    if (applicationEnd) parts.push(`Son başvuru: ${fmt(applicationEnd)}`);
    if (examDate) parts.push(`Sınav: ${fmt(examDate)}`);
    const summary = parts.length > 0 ? parts.join('. ') : null;

    const bodyLines: string[] = [];
    if (applicationEnd) bodyLines.push(`Son başvuru: ${fmt(applicationEnd)}`);
    if (examDate) bodyLines.push(`Sınav: ${fmt(examDate)}`);
    if (applicationUrl) bodyLines.push(`Başvuru: ${applicationUrl}`);

    if (rawText?.trim()) {
      const examDaysBlock = this.extractExamDaysAndSessionsFromText(rawText);
      if (examDaysBlock) {
        bodyLines.push('');
        bodyLines.push('Sınav günleri ve oturumlar:');
        bodyLines.push(examDaysBlock);
      }
    }

    const body = bodyLines.length > 0 ? bodyLines.join('\n') : null;

    return {
      summary: summary?.slice(0, 180) ?? null,
      body: body?.slice(0, 10000) ?? null,
    };
  }

  /** Scrape için: buildShortSummaryAndBody kullanarak kısa özet/içerik */
  private buildSummaryAndBody(
    bodyText: string | null,
    title: string,
    applicationEnd: Date | null,
    examDate: Date | null,
    applicationUrl: string | null,
  ): { summary: string | null; body: string | null } {
    return this.buildShortSummaryAndBody(bodyText, title, applicationEnd, examDate, applicationUrl);
  }

  /** Metinde başvuru URL'si ara (mebbis, e-devlet, osym, gis, auzefgis vb.) */
  private extractApplicationUrl(text: string): string | null {
    const patterns = [
      /(https?:\/\/[^\s<>"']*(?:mebbis|e-?devlet|osym\.gov\.tr|gis\.osym\.gov\.tr|augis\.anadolu\.edu\.tr|auzefgis\.istanbul\.edu\.tr)[^\s<>"']*)/i,
      /(https?:\/\/[^\s<>"']*(?:basvuru|tercih|yetki)[^\s<>"']*)/i,
      /((?:mebbis|e-?devlet|gis\.osym\.gov\.tr|augis\.anadolu\.edu\.tr|auzefgis\.istanbul\.edu\.tr)[^\s<>"']*)/i,
    ];
    for (const re of patterns) {
      const m = text.match(re);
      if (m) {
        let url = m[1].trim();
        if (!url.startsWith('http')) url = `https://${url}`;
        return url.length <= 1024 ? url : url.slice(0, 1024);
      }
    }
    return null;
  }

  /** HTML içeriğini doğru charset ile decode et – Türkçe karakter desteği */
  private decodeHtmlWithCharset(buffer: Buffer, contentType: string | null): string {
    let charset = contentType?.match(/charset=([^;]+)/i)?.[1]?.trim()?.toLowerCase() ?? '';
    if (!charset) {
      const head = buffer.subarray(0, Math.min(4096, buffer.length)).toString('utf-8');
      const meta = head.match(/<meta[^>]+charset\s*=\s*["']?([^"'\s>]+)/i) ?? head.match(/<meta[^>]+content\s*=\s*[^"']*charset\s*=\s*([^"'\s;]+)/i);
      charset = meta?.[1]?.trim()?.toLowerCase() ?? '';
    }
    const enc = charset === 'utf-8' || charset === 'utf8' ? 'utf-8'
      : charset === 'windows-1254' || charset === 'iso-8859-9' || charset === 'iso8859-9' ? 'windows-1254'
      : 'utf-8';
    try {
      return new TextDecoder(enc, { fatal: false }).decode(buffer);
    } catch {
      return buffer.toString('utf-8');
    }
  }

  /** Başlıktan kategori çıkar (kural tabanlı – agregatör için) */
  private inferCategoryFromTitle(title: string): string {
    const t = title.toLowerCase();
    if (/ösym|osym/i.test(t)) return 'osym';
    if (/aöf|açık öğretim|anadolu üniversitesi/i.test(t) && !/ataaof|ata-aöf|atı/i.test(t)) return 'aof';
    if (/ataaof|ata-aöf|atı üniversitesi/i.test(t)) return 'ataaof';
    if (/auzef|iüauzef|istanbul üniversitesi açık/i.test(t)) return 'auzef';
    if (/meb|milli eğitim|lgs|eğitim bakanlığı/i.test(t)) return 'meb';
    return 'meb'; // varsayılan
  }

  /** Metinde geçen resmi başvuru adresleri (GPT'den önce) */
  private inferCategoryFromUrlsInText(t: string): string | null {
    if (/auzefgis\.istanbul\.edu\.tr/i.test(t)) return 'auzef';
    if (/augis\.ata\.edu\.tr/i.test(t)) return 'ataaof';
    if (/augis\.anadolu\.edu\.tr/i.test(t)) return 'aof';
    if (/gis\.osym\.gov\.tr|ösym\.gov\.tr|osym\.gov\.tr/i.test(t)) return 'osym';
    if (/mebbis\.meb\.gov\.tr/i.test(t)) return 'meb';
    return null;
  }

  /** Haber/detay sayfası URL'sinden kurum (kaynak linki) */
  private inferCategoryFromSourceUrl(href: string): string | null {
    if (!href?.trim()) return null;
    try {
      const u = new URL(href.trim());
      const host = u.hostname.toLowerCase();
      if (host.includes('auzefgis')) return 'auzef';
      if (host.includes('augis.ata')) return 'ataaof';
      if (host.includes('augis.anadolu')) return 'aof';
      if (host.includes('gis.osym') || host === 'osym.gov.tr' || host.endsWith('.osym.gov.tr')) return 'osym';
      if (host.includes('mebbis')) return 'meb';
      return null;
    } catch {
      return null;
    }
  }

  private resolveExamDutyCategorySlug(params: {
    body: string | null;
    sourceHref: string;
    gptCategory: string | null;
    title: string;
    fallbackSlug: string;
    mode: 'rss' | 'scrape';
    detectPerItem?: boolean;
  }): string {
    const { body, sourceHref, gptCategory, title, fallbackSlug, mode, detectPerItem } = params;
    const gpt = normalizeExamDutyCategorySlug(gptCategory);
    const strong =
      this.inferCategoryFromBody(body) ?? this.inferCategoryFromSourceUrl(sourceHref);
    if (strong) return strong;
    if (mode === 'rss') {
      return gpt ?? normalizeExamDutyCategorySlug(fallbackSlug) ?? 'meb';
    }
    if (detectPerItem) {
      return gpt ?? this.inferCategoryFromTitle(title);
    }
    return normalizeExamDutyCategorySlug(fallbackSlug) ?? 'meb';
  }

  /** Metinden kategori: önce URL kalıpları, sonra ösym/mebbis (meb genel en sonda) */
  private inferCategoryFromBody(text: string | null): string | null {
    if (!text || text.length < 30) return null;
    const t = text.toLowerCase();
    const fromUrl = this.inferCategoryFromUrlsInText(t);
    if (fromUrl) return fromUrl;
    if (/auzef|auzefgis\.istanbul|iüauzef|istanbul üniversitesi açık/i.test(t)) return 'auzef';
    if (/ataaof|ata-aöf|atı üniversitesi/i.test(t)) return 'ataaof';
    if (/(?:aöf|açık öğretim|augis\.anadolu|anadolu üniversitesi)/i.test(t)) return 'aof';
    if (/ösym|osym/i.test(t)) return 'osym';
    if (/mebbis/i.test(t)) return 'meb';
    if (/meb|milli eğitim/i.test(t)) return 'meb';
    return null;
  }

  /** Body metninde başvuru duyurusu belirgin mi – Son Başvuru, gis.osym, mebbis vb. */
  private bodySuggestsApplication(text: string): boolean {
    if (!text || text.length < 50) return false;
    const lower = text.toLowerCase();
    /** Olay/haber: görev iptali, geç kalma, kare kod disiplini — resmi başvuru çağrısı değil */
    if (
      /görev(?:ler)?i\s*iptal|iptal\s*edildi|geç\s*gelen.*öğretmen|kare\s*kod.*(?:okut|giriş|sistem)/i.test(
        lower,
      ) &&
      !/başvuru\s*(?:açıldı|dönemi|yapıl|ekranı)|son\s*başvuru\s*tarihi|gis\.osym|mebbis\.meb|augis\.|auzefgis/i.test(
        lower,
      )
    ) {
      return false;
    }
    return (
      /son\s*başvuru|son\s*başvuru\s*tarihi|son\s*istek\s*(zamanı|tarihi|gün)/i.test(lower) ||
      /başvuru\s*(yapılır|yapılabilecek|açıldı|dönemi|:|\s+\d)/i.test(lower) ||
      /tercih\s*(süreci|son|edilir)/i.test(lower) ||
      /gis\.osym|gis\.osym\.gov\.tr|mebbis\.meb\.gov\.tr|augis\.anadolu\.edu\.tr|auzefgis\.istanbul\.edu\.tr|e-?devlet/i.test(
        lower,
      ) ||
      /sınav\s*başvurusu|görev\s*tercih|başvuru\s*açıldı/i.test(lower) ||
      /sınav\s*tarihi\s*:\s*\d|sınav\s*tarihleri/i.test(lower) ||
      /oturum\s*(zamanı|tarihi)|bina-?salon\s*görev/i.test(lower)
    );
  }

  /** Ücret/uyarı/ek gelir haberi mi (başvuru duyurusu değil) – kural tabanlı; tarihsiz genel bilgi atlanır */
  private isLikelyNonApplication(title: string): boolean {
    const t = title.toLowerCase();
    const hasBaşvuruSignal =
      /başvuru|yeni.*görev|görev.*başvuru|tercih.*süreci|oturum.*görev|görev.*oturum|sınav\s*görevi\s*başvuru/i.test(
        t,
      );
    if (hasBaşvuruSignal) return false;
    return (
      /ücret|zamlandı|zam|zamlı|belli oldu|açıklandı|uyarı|uyarılar|ek gelir|getiriyor|güncellendi|hesaplandı/.test(
        t,
      ) || /haftada\s*\d|ek\s*gelir\s*getiriyor|ne\s*kadar\s*\?/i.test(t)
    );
  }

  /** İçerik veya başlık belirgin sınav duyurusu mu (oturum, son istek, sınav tarihi tablosu) – bu durumda atlama yapılmaz */
  private bodyOrTitleSuggestsExamAnnouncement(body: string | null, title: string): boolean {
    const t = (title ?? '').toLowerCase();
    if (
      /(\d+\s*)?oturum.*sınav\s*görev|sınav\s*görev.*(\d+\s*)?oturum|yeni\s*sınav\s*görev/i.test(t) ||
      /son\s*istek\s*zamanı|oturum\s*zamanı|sınav\s*tarihi/i.test(t)
    )
      return true;
    if (!body || body.length < 80) return false;
    const lower = body.toLowerCase();
    return (
      /oturum\s*(zamanı|tarihi)|son\s*istek\s*(zamanı|tarihi|gün)/i.test(lower) ||
      /sınav\s*tarihi\s*:?\s*\d|\d{1,2}\/\d{1,2}\/\d{2,4}\s+\d{1,2}:\d{2}/.test(lower) ||
      (/salon\s*başkanı|gözetmen|e-?sınav\s*(başkan|gözetmen)/i.test(lower) &&
        (/\d+\s*tl|oturum|sınav\s*tarihi/i.test(lower)))
    );
  }

  /** Body sadece ücret/tablo bilgisi mi – sınav tarihi/başvuru yok */
  private bodyLooksLikeFeeInfoOnly(body: string | null, hasApplicationSignals: boolean): boolean {
    if (!body || hasApplicationSignals) return false;
    const lower = body.toLowerCase();
    const hasFeeKeywords =
      /ücret.*tablo|tablo.*ücret|brüt ücret|net ücret|hesaplanmış|güncellenmiştir|belli oldu|ek gelir|getiriyor/.test(
        lower,
      ) || (/\d+\s*tl|\d+\.\d+\s*tl/i.test(lower) && /ücret|brüt|net/i.test(lower));
    return hasFeeKeywords && !/son\s*başvuru|sınav\s*tarihi|tercih\s*son|başvuru\s*yapılır|gis\.|mebbis|augis|auzefgis/i.test(lower);
  }
}

export interface ExamDutySkippedItem {
  source_key: string;
  source_label: string;
  title: string;
  url: string;
  reason: string;
}

export interface SyncSourceResult {
  source_key: string;
  source_label: string;
  created: number;
  /** Silinen duyurunun sync ile geri yüklenen sayısı (scrape kaynakları) */
  restored?: number;
  skipped: number;
  error?: string;
  skipped_items?: ExamDutySkippedItem[];
  /** GPT API hata sayısı (extractFromText başarısız) */
  gpt_errors?: number;
  /** max_process_per_sync: son işlenen aday URL (bir sonraki sync'te ondan sonraki işlenir) */
  last_processed_url?: string | null;
}
