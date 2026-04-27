import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as cheerio from 'cheerio';
import { MebbisFetchDto, MebbisIlceQueryDto, MebbisTypeQueryDto } from './dto/mebbis-fetch.dto';
import { MEBBIS_IL_OPTIONS } from './mebbis-il-options.constants';
import { mapTypeLabel } from './mebbis-excel-to-schools.util';
import { mebbisKurumFilterLabelFromKurumAdiWithHeuristics } from './mebbis-kurum-type.util';
import { ReconcileSourceSchoolDto } from './dto/reconcile-schools.dto';
import { SchoolSegment, SchoolStatus, SchoolType } from '../types/enums';

const PUBLIC_MEB_SCHOOLS_URL = 'https://www.meb.gov.tr/baglantilar/okullar/index.php';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** MEB okul dizini: büyük illerde tablo çizimi ve HTTP istekleri uzun sürebilir */
const MEB_NAV_TIMEOUT_MS = 180_000;
const MEB_PLAYWRIGHT_DEFAULT_MS = 600_000;
const MEB_DETAIL_FETCH_MS = 55_000;
/** MEB DataTables serverSide: tek istekte çekilecek satır (okullar_ajax.php) */
const MEB_AJAX_PAGE_SIZE = 500;

@Injectable()
export class MebbisKurumlistesiService {
  private readonly logger = new Logger(MebbisKurumlistesiService.name);

  private async loadPlaywright(): Promise<typeof import('playwright')> {
    try {
      return await import('playwright');
    } catch {
      throw new ServiceUnavailableException({
        code: 'PLAYWRIGHT_MISSING',
        message:
          'Playwright kurulu değil. backend klasöründe: npm install playwright && npx playwright install chromium — ardından backend’i yeniden başlatın.',
      });
    }
  }

  /** Canlıda Chromium/Playwright yoksa veya MEB sayfası bozulursa 500 yerine anlamlı HTTP hatası. */
  private async withChromiumPage<T>(run: (page: import('playwright').Page) => Promise<T>): Promise<T> {
    const pw = await this.loadPlaywright();
    let browser: import('playwright').Browser | undefined;
    try {
      browser = await pw.chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });
      const page = await browser.newPage();
      page.setDefaultTimeout(MEB_PLAYWRIGHT_DEFAULT_MS);
      page.setDefaultNavigationTimeout(MEB_NAV_TIMEOUT_MS);
      return await run(page);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`MEB okul listesi (Playwright): ${msg}`);
      throw new BadGatewayException({
        code: 'EXTERNAL_SERVICE_ERROR',
        message: 'MEB okul listesi şu an okunamıyor. Sunucuda Chromium kurulu olmalı (örn. npx playwright install chromium).',
        details: { upstream: 'meb_okul_listesi', reason: msg.slice(0, 400) },
      });
    } finally {
      try {
        await browser?.close();
      } catch {
        /* noop */
      }
    }
  }

  getIlOptions() {
    return { items: MEBBIS_IL_OPTIONS.filter((x) => x.value !== '999') };
  }

  async getIlceOptions(dto: MebbisIlceQueryDto): Promise<{ items: { label: string }[] }> {
    const il = MEBBIS_IL_OPTIONS.find((x) => x.value === dto.il_kodu);
    if (!il) throw new BadRequestException({ code: 'INVALID_IL', message: 'Geçersiz il kodu.' });

    return this.withChromiumPage(async (page) => {
      await this.preparePublicListPage(page, dto.il_kodu);
      const rawRows = await this.readPublicRowsFromMebAjax(page, dto.il_kodu);
      const labels = rawRows
        .map((row) => {
          const parsed = this.parsePublicRowTitle(row.title);
          return parsed ? parsed.district : '';
        })
        .filter(Boolean);
      const uniq = [...new Set(labels)].sort((a, b) => a.localeCompare(b, 'tr'));
      return { items: uniq.map((label) => ({ label })) };
    });
  }

  async getTypeOptions(dto: MebbisTypeQueryDto): Promise<{ items: { label: string; value: string }[] }> {
    const il = MEBBIS_IL_OPTIONS.find((x) => x.value === dto.il_kodu);
    if (!il) throw new BadRequestException({ code: 'INVALID_IL', message: 'Geçersiz il kodu.' });

    return this.withChromiumPage(async (page) => {
      await this.preparePublicListPage(page, dto.il_kodu);
      const rawRows = await this.readPublicRowsFromMebAjax(page, dto.il_kodu);
      const items = [...new Set(
        rawRows
          .map((row) => this.parsePublicRowTitle(row.title))
          .filter(
            (parsed): parsed is { city: string; district: string; name: string } =>
              !!parsed &&
              this.normalizeText(parsed.city) === this.normalizeText(il.label) &&
              this.normalizeText(parsed.district) === this.normalizeText(dto.ilce_label),
          )
          .map((parsed) => mebbisKurumFilterLabelFromKurumAdiWithHeuristics(parsed.name))
          .filter((value): value is string => !!value),
      )].sort((a, b) => a.localeCompare(b, 'tr'));
      return { items: items.map((label) => ({ label, value: label })) };
    });
  }

  async fetchSchools(dto: MebbisFetchDto): Promise<{
    schools: ReconcileSourceSchoolDto[];
    meta: { row_count: number; sheet: string; tum_il: boolean };
  }> {
    const il = MEBBIS_IL_OPTIONS.find((x) => x.value === dto.il_kodu);
    if (!il) throw new BadRequestException({ code: 'INVALID_IL', message: 'Geçersiz il kodu.' });
    const tumIl = dto.tum_il === true;
    const ilceTrim = (dto.ilce_label ?? '').trim();
    if (!tumIl && !ilceTrim) {
      throw new BadRequestException({
        code: 'ILCE_OR_TUM_IL',
        message: 'İlçe seçin veya il geneli için tum_il: true gönderin.',
      });
    }

    return this.withChromiumPage(async (page) => {
      await this.preparePublicListPage(page, dto.il_kodu);
      const rawRows = await this.readPublicRowsFromMebAjax(page, dto.il_kodu);

      const schools: ReconcileSourceSchoolDto[] = [];
      for (const row of rawRows) {
        const parsed = this.parsePublicRowTitle(row.title);
        if (!parsed) continue;
        if (this.normalizeText(parsed.city) !== this.normalizeText(il.label)) continue;
        if (!tumIl && this.normalizeText(parsed.district) !== this.normalizeText(ilceTrim)) continue;
        if (dto.kurum_turu_contains?.trim() && !this.matchesTypeFilter(parsed.name, dto.kurum_turu_contains)) continue;

        const institutionCode = this.extractInstitutionCode(row.about_url, row.website_url, row.map_url);
        const detail = await this.fetchSchoolDetail(row.about_url, row.website_url, institutionCode);
        schools.push({
          name: parsed.name,
          type: mapTypeLabel(parsed.name),
          segment: this.mapSegment(dto.owner),
          city: this.toTitleCaseTr(parsed.city),
          district: this.toTitleCaseTr(parsed.district),
          institution_code: institutionCode,
          address: detail.address ?? undefined,
          map_url: row.map_url ?? undefined,
          school_image_url: detail.school_image_url ?? undefined,
          phone: detail.phone ?? undefined,
          fax: detail.fax ?? undefined,
          website_url: detail.website_url ?? this.normalizeWebsiteUrl(row.website_url) ?? undefined,
          institutional_email: detail.institutional_email ?? undefined,
          principal_name: undefined,
          about_description: detail.about_description ?? undefined,
          status: SchoolStatus.aktif,
        });
      }
      return {
        schools,
        meta: { row_count: schools.length, sheet: 'meb-public-okullar', tum_il: tumIl },
      };
    });
  }

  private mapSegment(owner: '1' | '2' | '3'): SchoolSegment {
    if (owner === '2') return SchoolSegment.ozel;
    return SchoolSegment.devlet;
  }

  private normalizeText(value: string | null | undefined): string {
    return String(value ?? '')
      .trim()
      .toLocaleLowerCase('tr-TR')
      .replace(/[ıİ]/g, 'i')
      .replace(/[şŞ]/g, 's')
      .replace(/[ğĞ]/g, 'g')
      .replace(/[üÜ]/g, 'u')
      .replace(/[öÖ]/g, 'o')
      .replace(/[çÇ]/g, 'c');
  }

  private toTitleCaseTr(value: string): string {
    return String(value)
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => {
        const lower = part.toLocaleLowerCase('tr-TR');
        return lower.charAt(0).toLocaleUpperCase('tr-TR') + lower.slice(1);
      })
      .join(' ');
  }

  private inferSchoolTypeFilter(rawFilter: string): SchoolType | null {
    const filter = this.normalizeText(rawFilter);
    if (!filter) return null;
    if ((Object.values(SchoolType) as string[]).includes(rawFilter)) return rawFilter as SchoolType;
    if (filter.includes('rehberlik') && filter.includes('arastirma')) return SchoolType.rehberlik_merkezi;
    if (filter.includes('ogretmenevi') || filter.includes('aksam sanat')) return SchoolType.ogretmenevi_aksam_sanat;
    if (filter.includes('mesleki egitim merkezi') && !filter.includes('lise') && !filter.includes('lisesi')) return SchoolType.mesleki_egitim_merkezi;
    if (filter.includes('ozel egitim uygulama merkez')) return SchoolType.ozel_egitim_uygulama_merkezi;
    if (filter.includes('anaokul')) return SchoolType.anaokul;
    if (filter.includes('ilkokul')) return SchoolType.ilkokul;
    if (filter.includes('ortaokul') && !filter.includes('imam')) return SchoolType.ortaokul;
    if (filter.includes('imam') && filter.includes('orta')) return SchoolType.imam_hatip_ortaokul;
    if (filter.includes('imam') && filter.includes('lise')) return SchoolType.imam_hatip_lise;
    if (filter.includes('meslek') || filter.includes('mtal') || filter.includes('mesleki ve teknik')) return SchoolType.meslek_lisesi;
    if (filter.includes('bilsem') || (filter.includes('bilim ve sanat') && filter.includes('merkez'))) return SchoolType.bilsem;
    if (filter.includes('halk') && filter.includes('egitim')) return SchoolType.halk_egitim;
    if (filter.includes('ozel egitim')) return SchoolType.ozel_egitim;
    if (filter.includes('fen lisesi') || filter.includes('fenlisesi')) return SchoolType.fen_lisesi;
    if (filter.includes('sosyal bilim')) return SchoolType.sosyal_bilimler_lisesi;
    if (filter.includes('anadolu') && filter.includes('cok')) return SchoolType.cok_programli_anadolu_lisesi;
    if (filter.includes('anadolu')) return SchoolType.anadolu_lisesi;
    if (filter.includes('acik ogretim')) return SchoolType.acik_ogretim_lisesi;
    if (filter.includes('guzel sanat')) return SchoolType.guzel_sanatlar_lisesi;
    if (filter.includes('spor lise')) return SchoolType.spor_lisesi;
    if (filter.includes('temel egitim') || filter.includes('ilkogretim')) return SchoolType.temel_egitim;
    if (filter.includes('lise')) return SchoolType.lise;
    return null;
  }

  private matchesTypeFilter(name: string, rawFilter: string): boolean {
    const filter = this.normalizeText(rawFilter);
    if (!filter) return true;
    const inferredPublicType = mebbisKurumFilterLabelFromKurumAdiWithHeuristics(name);
    if (inferredPublicType && this.normalizeText(inferredPublicType) === filter) return true;
    const inferredFilterType = this.inferSchoolTypeFilter(rawFilter);
    const inferredNameType = mapTypeLabel(name);
    if (inferredFilterType) return inferredFilterType === inferredNameType;
    return this.normalizeText(name).includes(filter);
  }

  private async preparePublicListPage(page: import('playwright').Page, ilKodu: string) {
    await page.goto(PUBLIC_MEB_SCHOOLS_URL, {
      waitUntil: 'domcontentloaded',
      timeout: MEB_NAV_TIMEOUT_MS,
    });
    await page.selectOption('#ILADI', ilKodu);
    await sleep(1200);
  }

  /**
   * MEB sayfası DataTables `serverSide: true` kullanıyor; DOM’da yalnızca bir sayfa satırı kalıyor.
   * Aynı origin üzerinden `okullar_ajax.php` ile tüm kayıtları sayfalayarak okur.
   */
  private async readPublicRowsFromMebAjax(
    page: import('playwright').Page,
    ilKodu: string,
  ): Promise<Array<{ title: string; website_url: string | null; about_url: string | null; map_url: string | null }>> {
    return page.evaluate(
      async ({ il, pageSize }) => {
        type Row = { title: string; website_url: string | null; about_url: string | null; map_url: string | null };
        const out: Row[] = [];
        let start = 0;
        for (;;) {
          const body = new URLSearchParams({
            draw: '1',
            start: String(start),
            length: String(pageSize),
            il: String(il),
            ilce: '0',
          });
          const res = await fetch('/baglantilar/okullar/okullar_ajax.php', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
              'X-Requested-With': 'XMLHttpRequest',
            },
            body,
            credentials: 'include',
          });
          const text = await res.text();
          const trimmed = text.trim();
          if (!trimmed.startsWith('{')) {
            throw new Error(trimmed.slice(0, 240) || `HTTP ${res.status}`);
          }
          const j = JSON.parse(trimmed) as {
            data?: { OKUL_ADI: string; HOST: string; YOL: string }[];
            recordsTotal?: number;
            recordsFiltered?: number;
          };
          const chunk = j.data ?? [];
          const total = Math.max(j.recordsFiltered ?? 0, j.recordsTotal ?? 0, 0);
          for (const row of chunk) {
            const host = String(row.HOST ?? '').trim();
            const yol = String(row.YOL ?? '').trim();
            const okulAdi = String(row.OKUL_ADI ?? '').trim();
            if (!okulAdi || !host) continue;
            const website = `https://${host}.meb.k12.tr`;
            const about = yol ? `${website}/meb_iys_dosyalar/${yol}/okulumuz_hakkinda.html` : null;
            out.push({
              title: okulAdi,
              website_url: website,
              about_url: about,
              map_url: `${website}/tema/harita.php`,
            });
          }
          start += chunk.length;
          if (!chunk.length || (total > 0 && start >= total)) break;
        }
        return out;
      },
      { il: ilKodu, pageSize: MEB_AJAX_PAGE_SIZE },
    );
  }

  private parsePublicRowTitle(title: string): { city: string; district: string; name: string } | null {
    const parts = String(title ?? '')
      .split(/\s*[-\u2013\u2014\u2212]\s*/)
      .map((x) => x.trim())
      .filter(Boolean);
    if (parts.length < 3) return null;
    return {
      city: parts[0],
      district: parts[1],
      name: parts.slice(2).join(' - '),
    };
  }

  private extractInstitutionCode(...urls: Array<string | null>): string | undefined {
    for (const url of urls) {
      if (!url) continue;
      const pathSegments = url.match(/\/(\d{4,16})(?=\/|\.|$)/g) ?? [];
      if (pathSegments.length > 0) {
        const last = pathSegments[pathSegments.length - 1].replace(/\D/g, '');
        if (/^\d{4,16}$/.test(last)) return last;
      }
      try {
        const host = new URL(url).hostname.split('.')[0];
        if (/^\d{4,16}$/.test(host)) return host;
      } catch {
        continue;
      }
    }
    return undefined;
  }

  private normalizeWebsiteUrl(raw: string | null | undefined): string | undefined {
    const t = raw?.trim();
    if (!t) return undefined;
    if (/^https?:\/\//i.test(t)) return t;
    if (!/\s/.test(t) && !t.includes('@') && t.includes('.')) return `https://${t}`;
    return undefined;
  }

  private decodeHtmlText(raw: string | null | undefined): string | undefined {
    if (!raw) return undefined;
    const text = cheerio.load(`<div>${raw}</div>`)('div').text().replace(/\s+/g, ' ').trim();
    return text || undefined;
  }

  private resolveUrl(raw: string | null | undefined, baseUrl: string | null | undefined): string | undefined {
    const value = raw?.trim();
    if (!value) return undefined;
    try {
      return new URL(value, baseUrl ?? undefined).toString();
    } catch {
      return undefined;
    }
  }

  private buildAboutDescription(summary: Record<string, string>, stats: Record<string, string>): string | undefined {
    const lines: string[] = [];
    const preferredSummaryKeys = [
      'Vizyon',
      'Misyon',
      'Başarılar',
      'Öğretim Şekli',
      'Saatler',
      'Isınma',
      'Bağlantı',
      'Yabancı Dil',
      'Ulaşım',
      'Servis Bilgisi',
      'Yerleşim Yeri',
      'İl/İlçe Merkezine Uzaklık',
      'Kontenjan Bilgileri',
    ];
    for (const key of preferredSummaryKeys) {
      const value = summary[key];
      if (value) lines.push(`${key}: ${value}`);
    }
    const preferredStatsKeys = ['Öğrenci', 'Derslik', 'Öğretim Şekli'];
    for (const key of preferredStatsKeys) {
      const value = stats[key];
      if (value && !lines.some((line) => line.startsWith(`${key}:`))) {
        lines.push(`${key}: ${value}`);
      }
    }
    return lines.length > 0 ? lines.join('\n') : undefined;
  }

  private contactPageUrl(aboutUrl: string | null, websiteUrl: string | null): string | undefined {
    const base = this.normalizeWebsiteUrl(websiteUrl) ?? aboutUrl ?? undefined;
    if (!base) return undefined;
    return this.resolveUrl('/tema/iletisim.php', base);
  }

  private cleanContactValue(raw: string | null | undefined): string | undefined {
    const value = raw?.replace(/\s+/g, ' ').replace(/-+$/g, '').trim();
    return value || undefined;
  }

  private normalizeInfoLabel(raw: string | null | undefined): string | undefined {
    const value = raw?.replace(/\s+/g, ' ').replace(/\s*:\s*$/g, '').trim();
    if (!value) return undefined;
    const normalized = this.normalizeText(value);
    const labelMap: Record<string, string> = {
      web: 'WEB',
      telefon: 'Telefon',
      belgegecer: 'Belgegeçer',
      fax: 'Fax',
      adres: 'Adres',
      eposta: 'Eposta',
      vizyon: 'Vizyon',
      misyon: 'Misyon',
      basarilar: 'Başarılar',
      'ogretim sekli': 'Öğretim Şekli',
      saatler: 'Saatler',
      isinma: 'Isınma',
      baglanti: 'Bağlantı',
      'yabanci dil': 'Yabancı Dil',
      ulasim: 'Ulaşım',
      'servis bilgisi': 'Servis Bilgisi',
      'yerlesim yeri': 'Yerleşim Yeri',
      'il/ilce merkezine uzaklik': 'İl/İlçe Merkezine Uzaklık',
      'kontenjan bilgileri': 'Kontenjan Bilgileri',
    };
    return labelMap[normalized] ?? value;
  }

  private extractInfoRows($: cheerio.CheerioAPI, selector: string, labelSelector: string, valueSelector: string): Record<string, string> {
    const data: Record<string, string> = {};
    $(selector).each((_, el) => {
      const row = $(el);
      const label = this.normalizeInfoLabel(row.find(labelSelector).first().text());
      const valueNode = row.find(valueSelector).first();
      const valueHtml = valueNode.html()?.replace(/<br\s*\/?>/gi, ' ') ?? '';
      const value = (valueHtml ? cheerio.load(`<div>${valueHtml}</div>`)('div').text() : valueNode.text())
        .replace(/\s+/g, ' ')
        .trim();
      if (label && value && label !== 'Eposta' && label !== 'Yazdır') data[label] = value;
    });
    return data;
  }

  private async fetchTextWithTimeout(url: string, headers: Record<string, string>, ms: number): Promise<string> {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), ms);
    try {
      const res = await fetch(url, { headers, signal: ac.signal });
      return res.ok ? await res.text() : '';
    } catch {
      return '';
    } finally {
      clearTimeout(t);
    }
  }

  private async fetchSchoolDetail(
    aboutUrl: string | null,
    websiteUrl: string | null,
    institutionCode?: string,
  ): Promise<{
    address?: string;
    phone?: string;
    fax?: string;
    website_url?: string;
    institutional_email?: string;
    school_image_url?: string;
    about_description?: string;
  }> {
    const aboutTargetUrl = aboutUrl ?? websiteUrl;
    const contactTargetUrl = this.contactPageUrl(aboutUrl, websiteUrl);
    if (!aboutTargetUrl && !contactTargetUrl) return {};
    try {
      const headers = {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Safari/537.36',
      };
      const [aboutHtml, contactHtml] = await Promise.all([
        aboutTargetUrl ? this.fetchTextWithTimeout(aboutTargetUrl, headers, MEB_DETAIL_FETCH_MS) : Promise.resolve(''),
        contactTargetUrl
          ? this.fetchTextWithTimeout(contactTargetUrl, headers, MEB_DETAIL_FETCH_MS)
          : Promise.resolve(''),
      ]);
      const $about = cheerio.load(aboutHtml || '<html></html>');
      const $contact = cheerio.load(contactHtml || '<html></html>');
      const aboutSummary: Record<string, string> = {
        ...this.extractInfoRows($about, '#hakkinda_kutu > .col-sm-12 > .row', '.col-xs-3', '.col-sm-8.col-xs-7'),
        ...this.extractInfoRows($about, '#middle_content .table tr', 'td:nth-child(2)', 'td:nth-child(3)'),
      };
      const contactSummary: Record<string, string> = {
        ...this.extractInfoRows($contact, '#adres_kutu .row, #dosya_liste .col-sm-6 .row', '.col-xs-3', '.col-xs-7'),
        ...this.extractInfoRows($contact, '#middle_content .table tr', 'td:nth-child(2)', 'td:nth-child(3)'),
      };
      const stats: Record<string, string> = {};
      $about('#hakkinda_kutu_2 .col-sm-4').each((_, el) => {
        const text = $about(el).text().replace(/\s+/g, ' ').trim();
        const match = text.match(/^([^:]+):\s*(.+)$/);
        if (!match) return;
        const key = match[1].trim();
        const value = match[2].trim();
        if (key && value) stats[key] = value;
      });
      const imageSrc =
        $about('#okul_thumb').first().attr('src') ||
        $about('.image_shadow_container img').first().attr('src') ||
        $about('#dosya_liste img').first().attr('src') ||
        $about('img[alt*="Fotoğraf"]').first().attr('src');
      const website = contactSummary.WEB ?? aboutSummary.WEB;
      const email =
        (contactHtml + '\n' + aboutHtml).match(/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i)?.[1] ??
        (institutionCode && this.normalizeWebsiteUrl(websiteUrl)?.includes('.meb.k12.tr')
          ? `${institutionCode}@meb.k12.tr`
          : undefined);
      return {
        address: this.cleanContactValue(contactSummary.Adres) ?? this.cleanContactValue(aboutSummary.Adres),
        phone: this.cleanContactValue(contactSummary.Telefon) ?? this.cleanContactValue(aboutSummary.Telefon),
        fax:
          this.cleanContactValue(contactSummary.Belgegeçer) ??
          this.cleanContactValue(contactSummary.Fax) ??
          this.cleanContactValue(aboutSummary.Belgegeçer) ??
          this.cleanContactValue(aboutSummary.Fax),
        website_url: this.normalizeWebsiteUrl(website) ?? this.normalizeWebsiteUrl(websiteUrl) ?? undefined,
        institutional_email: email,
        school_image_url: this.resolveUrl(imageSrc, aboutTargetUrl),
        about_description: this.buildAboutDescription(aboutSummary, stats),
      };
    } catch {
      return {
        website_url: this.normalizeWebsiteUrl(websiteUrl) ?? undefined,
        institutional_email:
          institutionCode && this.normalizeWebsiteUrl(websiteUrl)?.includes('.meb.k12.tr')
            ? `${institutionCode}@meb.k12.tr`
            : undefined,
      };
    }
  }
}
