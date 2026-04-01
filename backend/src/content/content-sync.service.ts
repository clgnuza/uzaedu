/**
 * RSS ve web scraping ile content_sources'tan otomatik içerik çekme.
 */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { XMLParser } from 'fast-xml-parser';
import * as cheerio from 'cheerio';
import { ContentSource } from './entities/content-source.entity';
import { ContentItem } from './entities/content-item.entity';

export interface SyncSourceResult {
  source_key: string;
  source_label: string;
  created: number;
  skipped: number;
  error?: string;
}

export interface SyncResult {
  ok: boolean;
  message: string;
  results: SyncSourceResult[];
  total_created: number;
}

const FETCH_TIMEOUT_MS = 12000;
const TITLE_MAX_LEN = 512;
const ARTICLE_IMAGE_TIMEOUT_MS = 8000;
const RSS_ITEM_LIMIT = 100;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** Başlıkta yarışma/olimpiyat geçen içerikleri competition olarak işaretle (tüm MEB kaynakları) */
function inferCompetitionContentTypeFromTitle(title: string): 'competition' | 'news' {
  if (!title || title.length < 4) return 'news';
  if (
    /yarışma|yarışması|yarismasi|olimpiyat|ölimpiyat|ödüllü\s+yarışma|yarışması\s+sonuç/i.test(title)
  ) {
    return 'competition';
  }
  return 'news';
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

/** MEB linklerini https'e normalize et */
function normalizeMebUrl(url: string): string {
  if (!url || typeof url !== 'string') return url;
  const u = url.trim();
  if (u.match(/^https?:\/\/([a-z0-9-]+\.)*meb\.gov\.tr/i) && u.startsWith('http://')) {
    return 'https://' + u.slice(7);
  }
  return u;
}

/** İl MEB: RSS "duzcemeb.gov.tr" → DNS "duzce.meb.gov.tr" */
function normalizeMebIlImageHost(url: string): string {
  if (!url || typeof url !== 'string' || !url.trim().startsWith('http')) return url;
  try {
    const u = new URL(url.trim());
    const m = /^([a-z0-9-]+)meb\.gov\.tr$/i.exec(u.hostname);
    if (m) {
      u.hostname = `${m[1]}.meb.gov.tr`;
      return u.toString();
    }
  } catch {
    /* ignore */
  }
  return url;
}

function normalizeMebImageAsset(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  return normalizeMebUrl(normalizeMebIlImageHost(url.trim()));
}

/** MEB logosu, mansetresim vb. genel placeholder görselleri haber görseli sayma */
function isPlaceholderImage(url: string | null): boolean {
  if (!url || typeof url !== 'string') return true;
  const u = url.toLowerCase();
  return (
    /logo[_-]?meb|logo\.png$/i.test(u) ||
    /mansetresim\.png$/i.test(u) ||
    /\/www\/images\/logo/i.test(u) ||
    /\/images\/logo/i.test(u)
  );
}

function extractLink(entry: Record<string, unknown>, baseUrl?: string | null): string {
  const link =
    entry.link ?? entry.guid ?? entry.id ?? entry.url;
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
  return normalizeMebUrl(href);
}

function parseRssDate(value: unknown): Date | null {
  if (!value) return null;
  const str = String(value).trim();
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

/** value string veya {#text,_} objesi olabilir */
function asString(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    return String(o['#text'] ?? o._ ?? o.url ?? '').trim();
  }
  return String(value).trim();
}

/** HTML, enclosure, media:content, media:thumbnail'dan resim URL çıkar. Placeholder (logo, mansetresim) reddedilir. */
function extractImageFromEntry(entry: Record<string, unknown>, baseUrl?: string | null): string | null {
  const filterPlaceholder = (url: string): string | null => {
    if (!url) return null;
    let u = url.trim();
    if (baseUrl && u.startsWith('/')) u = baseUrl.replace(/\/$/, '') + u;
    u = normalizeMebImageAsset(u) ?? u;
    return isPlaceholderImage(u) ? null : u;
  };
  // 1) Description/summary/content içindeki ilk img
  const rawDesc = asString(entry.description ?? entry.summary ?? entry.content ?? entry['content:encoded']);
  if (rawDesc) {
    const m = rawDesc.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (m) {
      const url = filterPlaceholder(m[1]);
      if (url) return url;
    }
  }
  // 2) media:content veya media:thumbnail
  const media = entry['media:content'] ?? entry['media:thumbnail'];
  const mediaObj = Array.isArray(media) ? media[0] : media;
  if (mediaObj && typeof mediaObj === 'object') {
    const u = (mediaObj as Record<string, unknown>).url ?? (mediaObj as Record<string, unknown>)['@_url'];
    const s = asString(u);
    if (s) {
      const url = filterPlaceholder(s);
      if (url) return url;
    }
  }
  // 3) enclosure (type image/*)
  const enc = entry.enclosure;
  const encObj = Array.isArray(enc) ? enc[0] : enc;
  if (encObj && typeof encObj === 'object') {
    const o = encObj as Record<string, unknown>;
    const type = String(o.type ?? o['@_type'] ?? '').toLowerCase();
    if (type.startsWith('image/')) {
      const u = o.url ?? o['@_url'];
      const s = asString(u);
      if (s) {
        const url = filterPlaceholder(s);
        if (url) return url;
      }
    }
  }
  return null;
}

/** RSS'te görsel yoksa haber sayfasından og:image / twitter:image / içerik img çek. Placeholder reddedilir. */
async function fetchImageFromArticle(articleUrl: string): Promise<string | null> {
  if (!articleUrl?.trim() || !articleUrl.startsWith('http')) return null;
  try {
    const res = await fetch(articleUrl, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      signal: AbortSignal.timeout(ARTICLE_IMAGE_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const html = await res.text();

    const toResult = (raw: string | undefined): string | null => {
      if (!raw?.trim()) return null;
      const url = normalizeMebImageAsset(raw.trim());
      if (!url) return null;
      return isPlaceholderImage(url) ? null : url;
    };

    // 1) og:image veya twitter:image
    const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    const twMatch = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
    const metaImg = toResult(ogMatch?.[1] ?? twMatch?.[1]);
    if (metaImg) return metaImg;

    // 2) İçerik alanındaki ilk img (MEB il sayfaları og:image kullanmayabilir)
    const $ = cheerio.load(html);
    const contentSelectors = [
      '#icerik img', '.icerik img', '.content img', 'main img', 'article img',
      '.duyuru-icerik img', '.haber-icerik img', '#haber_detay img', '.haber_detay img',
      'body img',
    ];
    for (const sel of contentSelectors) {
      const first = $(sel).filter((_, el) => {
        const src = $(el).attr('src');
        if (!src) return false;
        const u = src.startsWith('http') ? src : new URL(src, articleUrl).href;
        return !isPlaceholderImage(u) && !/^(data:|blob:)/.test(src);
      }).first();
      if (first.length) {
        let src = first.attr('src');
        if (src && !src.startsWith('http')) {
          try {
            src = new URL(src, articleUrl).href;
          } catch {
            return null;
          }
        }
        const result = toResult(src);
        if (result) return result;
      }
    }
    return null;
  } catch {
    return null;
  }
}

@Injectable()
export class ContentSyncService {
  constructor(
    @InjectRepository(ContentSource)
    private readonly sourceRepo: Repository<ContentSource>,
    @InjectRepository(ContentItem)
    private readonly itemRepo: Repository<ContentItem>,
  ) {}

  /** Placeholder (logo, mansetresim) görsellerini temizler */
  async clearPlaceholderImages(): Promise<{ cleared: number }> {
    const items = await this.itemRepo
      .createQueryBuilder('i')
      .where('i.imageUrl IS NOT NULL')
      .andWhere('i.is_active = :active', { active: true })
      .getMany();

    let cleared = 0;
    for (const item of items) {
      if (item.imageUrl && isPlaceholderImage(item.imageUrl)) {
        item.imageUrl = null;
        await this.itemRepo.save(item);
        cleared++;
      }
    }
    return { cleared };
  }

  /** image_url boş kayıtları haber sayfasından og:image ile doldurur */
  async backfillMissingImages(limit = 200): Promise<{ updated: number; failed: number }> {
    const items = await this.itemRepo
      .createQueryBuilder('i')
      .where('(i.image_url IS NULL OR i.image_url = :empty)', { empty: '' })
      .andWhere('i.source_url IS NOT NULL')
      .andWhere('i.source_url != :empty2', { empty2: '' })
      .andWhere('i.is_active = :active', { active: true })
      .orderBy('i.published_at', 'DESC')
      .take(limit)
      .getMany();

    let updated = 0;
    let failed = 0;
    for (const item of items) {
      const img = await fetchImageFromArticle(item.sourceUrl);
      if (img) {
        item.imageUrl = img;
        await this.itemRepo.save(item);
        updated++;
      } else {
        failed++;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    return { updated, failed };
  }

  async runSync(): Promise<SyncResult> {
    const sources = await this.sourceRepo.find({ where: { isActive: true } });
    const syncable = sources.filter(
      (s) => s.rssUrl?.trim() || (s.baseUrl?.trim() && s.scrapeConfig && Object.keys(s.scrapeConfig).length > 0),
    );
    const results: SyncSourceResult[] = [];
    let totalCreated = 0;

    for (const source of syncable) {
      const result = await this.syncSource(source);
      results.push(result);
      totalCreated += result.created;
    }

    const hasRealError = results.some((r) => r.error && !r.error.includes('tanımlı değil'));
    const totalSkipped = results.reduce((a, r) => a + r.skipped, 0);
    return {
      ok: !hasRealError,
      message: hasRealError
        ? 'Bazı kaynaklarda hata oluştu. Detaylar için sonuçlara bakın.'
        : totalCreated > 0
          ? `${totalCreated} yeni içerik eklendi.`
          : totalSkipped > 0
            ? 'Güncel. Tüm içerikler zaten mevcut, görseller güncellendi.'
            : 'Yeni içerik yok (tümü zaten mevcut).',
      results,
      total_created: totalCreated,
    };
  }

  private async syncSource(source: ContentSource): Promise<SyncSourceResult> {
    const base: SyncSourceResult = {
      source_key: source.key,
      source_label: source.label,
      created: 0,
      skipped: 0,
    };

    try {
      if (source.rssUrl?.trim()) {
        const rssResult = await this.syncFromRss(source);
        base.created = rssResult.created;
        base.skipped = rssResult.skipped;
      } else if (source.scrapeConfig && source.baseUrl?.trim()) {
        const scrapeResult = await this.syncFromScrape(source);
        base.created = scrapeResult.created;
        base.skipped = scrapeResult.skipped;
      } else {
        base.skipped = 0;
        base.error = 'rss_url veya (base_url + scrape_config) tanımlı değil';
      }

      if (!base.error) {
        source.lastSyncedAt = new Date();
        await this.sourceRepo.save(source);
      }
    } catch (e) {
      base.error = e instanceof Error ? e.message : String(e);
    }

    return base;
  }

  private async syncFromRss(source: ContentSource): Promise<{ created: number; skipped: number }> {
    const url = source.rssUrl!.trim();
    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/xml, application/xml, application/rss+xml, */*',
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`RSS indirilemedi (${url}): ${msg}`);
    }

    if (!res.ok) {
      throw new Error(`RSS HTTP ${res.status} (${url})`);
    }

    const buffer = await res.arrayBuffer();
    const charset =
      res.headers.get('content-type')?.match(/charset=([^;]+)/i)?.[1]?.trim()?.toLowerCase() ?? 'utf-8';
    const xml = new TextDecoder(
      charset === 'utf-8' || charset === 'utf8' ? 'utf-8' : 'iso-8859-9',
    ).decode(buffer);

    const parser = new XMLParser({ ignoreAttributes: false, trimValues: true });
    let obj: unknown;
    try {
      obj = parser.parse(xml);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`RSS XML ayrıştırılamadı (${url}): ${msg}`);
    }
    const root = obj as { rss?: { channel?: unknown }; feed?: unknown } | undefined;
    const channel = (root?.rss?.channel ?? root?.feed) as Record<string, unknown> | undefined;
    const rawItems = channel?.item ?? channel?.entry ?? [];
    const itemLimit = source.rssItemLimit ?? RSS_ITEM_LIMIT;
    const entries = (Array.isArray(rawItems) ? rawItems : [rawItems]).slice(0, itemLimit);

    let created = 0;
    let skipped = 0;

    for (const entry of entries.filter(Boolean)) {
      const e = entry as Record<string, unknown>;
      const title = extractText(e.title ?? e['title']).slice(0, TITLE_MAX_LEN);
      if (!title) continue;

      let link = extractLink(e, source.baseUrl);
      if (!link && e.link) {
        const l = e.link;
        if (typeof l === 'string') link = l;
        else if (l && typeof l === 'object' && 'href' in l) link = String((l as { href?: string }).href ?? '');
      }
      if (!link) continue;

      const rawDesc = asString(e.description ?? e.summary ?? e.content ?? e['content:encoded']);
      const summary = extractText(e.description ?? e.summary ?? e.content ?? e['content:encoded']);
      const publishedAt = parseRssDate(e.pubDate ?? e.published ?? e.updated ?? e['dc:date']);
      let imageUrl = extractImageFromEntry(e, source.baseUrl);
      if (!imageUrl && link) {
        imageUrl = await fetchImageFromArticle(link);
      }

      const altUrl =
        link.startsWith('https://') ? 'http://' + link.slice(8) : link.startsWith('http://') ? 'https://' + link.slice(7) : link;
      const exists = await this.itemRepo.findOne({
        where: [
          { sourceId: source.id, sourceUrl: link },
          { sourceId: source.id, sourceUrl: altUrl },
        ],
      });
      if (exists) {
        skipped++;
        let img = imageUrl;
        if (!exists.imageUrl && !img && link) img = await fetchImageFromArticle(link);
        const hasPlaceholder = exists.imageUrl && isPlaceholderImage(exists.imageUrl);
        if (hasPlaceholder) {
          exists.imageUrl = null;
        }
        const inferred = inferCompetitionContentTypeFromTitle(title);
        if (inferred === 'competition' && exists.contentType !== 'competition') {
          exists.contentType = 'competition';
        }
        if ((!exists.imageUrl || hasPlaceholder) && img) {
          exists.imageUrl = img;
          exists.summary = summary || exists.summary;
          await this.itemRepo.save(exists);
        } else if (hasPlaceholder || inferred === 'competition') {
          await this.itemRepo.save(exists);
        }
        continue;
      }

      const cityFilter = source.key.startsWith('il_') ? source.key.replace(/^il_/, '') : null;
      const item = this.itemRepo.create({
        sourceId: source.id,
        contentType: inferCompetitionContentTypeFromTitle(title),
        title,
        summary: summary || null,
        sourceUrl: link,
        imageUrl: imageUrl || null,
        publishedAt: publishedAt ?? new Date(),
        isActive: true,
        cityFilter,
      });
      await this.itemRepo.save(item);
      created++;
    }

    return { created, skipped };
  }

  private async syncFromScrape(source: ContentSource): Promise<{ created: number; skipped: number }> {
    const config = source.scrapeConfig as {
      list_urls?: string[] | Array<{ path: string; content_type?: string }>;
      item_selector?: string;
      link_selector?: string;
      title_selector?: string;
      date_selector?: string;
      base_url_override?: string | null;
    } | null;

    if (!config?.list_urls?.length) {
      throw new Error('scrape_config.list_urls tanımlı değil');
    }

    const base = (config.base_url_override ?? source.baseUrl ?? '').replace(/\/$/, '');
    const listUrls = config.list_urls;
    const itemSelector = config.item_selector ?? 'a[href*="/icerik/"]';
    const defaultContentType = 'announcement';

    const candidates: { title: string; href: string; contentType: string; publishedAt: Date }[] = [];

    for (const listEntry of listUrls) {
      const path = typeof listEntry === 'string' ? listEntry : (listEntry as { path: string; content_type?: string }).path;
      const contentType =
        typeof listEntry === 'object' && listEntry && 'content_type' in listEntry
          ? (listEntry as { content_type?: string }).content_type ?? defaultContentType
          : defaultContentType;

      const fullUrl = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? '' : '/'}${path}`;

      const res = await fetch(fullUrl, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      if (!res.ok) continue;

      const html = await res.text();
      const $ = cheerio.load(html);

      const linkSelector = config.link_selector ?? 'a[href*="/icerik/"]';
      const titleSelector = config.title_selector ?? 'a';
      const dateSelector = config.date_selector ?? '';

      $(itemSelector).each((_, el) => {
        const $el = $(el);
        const $link = $el.is('a') ? $el : (linkSelector ? $el.find(linkSelector).first() : $el.find('a').first());
        if ($link.length === 0) return;

        let href = $link.attr('href') ?? '';
        if (!href) return;
        if (href.startsWith('/')) href = `${base}${href}`;
        else if (!href.startsWith('http')) href = `${base}/${href}`;

        const title = (titleSelector ? $el.find(titleSelector).first() : $link).text().trim().slice(0, TITLE_MAX_LEN);
        if (!title) return;

        let dateStr = '';
        if (dateSelector) {
          dateStr = $el.find(dateSelector).first().text().trim();
        }
        const publishedAt = dateStr ? this.parseTrDate(dateStr) : new Date();
        candidates.push({ title, href, contentType, publishedAt: publishedAt ?? new Date() });
      });
    }

    let created = 0;
    let skipped = 0;
    const seen = new Set<string>();

    for (const c of candidates) {
      if (seen.has(c.href)) continue;
      seen.add(c.href);

      const exists = await this.itemRepo.findOne({
        where: { sourceId: source.id, sourceUrl: c.href },
      });
      if (exists) {
        skipped++;
        continue;
      }

      const inferred = inferCompetitionContentTypeFromTitle(c.title);
      const item = this.itemRepo.create({
        sourceId: source.id,
        contentType: inferred === 'competition' ? 'competition' : c.contentType,
        title: c.title,
        summary: null,
        sourceUrl: c.href,
        publishedAt: c.publishedAt,
        isActive: true,
      });
      await this.itemRepo.save(item);
      created++;
    }

    return { created, skipped };
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
}
