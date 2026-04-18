import { Injectable, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { MebbisFetchDto, MebbisIlceQueryDto, MebbisTypeQueryDto } from './dto/mebbis-fetch.dto';
import { MEBBIS_IL_OPTIONS } from './mebbis-il-options.constants';
import { mapTypeLabel } from './mebbis-excel-to-schools.util';
import { ReconcileSourceSchoolDto } from './dto/reconcile-schools.dto';
import { SchoolSegment, SchoolStatus, SchoolType } from '../types/enums';

const PUBLIC_MEB_SCHOOLS_URL = 'https://www.meb.gov.tr/baglantilar/okullar/index.php';
const PUBLIC_INSTITUTION_TYPE_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'Öğretmenevi ve Akşam Sanat Okulu', pattern: /ogretmenevi ve aksam sanat okulu$/ },
  { label: 'Rehberlik ve Araştırma Merkezi', pattern: /rehberlik ve arastirma merkezi$/ },
  { label: 'Bilim ve Sanat Merkezi', pattern: /bilim ve sanat merkezi$/ },
  { label: 'Halk Eğitimi Merkezi', pattern: /halk egitimi merkezi$/ },
  { label: 'Mesleki Eğitim Merkezi', pattern: /mesleki egitim merkezi$/ },
  { label: 'Özel Eğitim Uygulama Merkezi', pattern: /ozel egitim uygulama merkezi(?:si)?(?:.*kademe)?$/ },
  { label: 'Özel Eğitim Uygulama Okulu', pattern: /ozel egitim uygulama okulu(?:.*kademe)?$/ },
  { label: 'Çok Programlı Anadolu Lisesi', pattern: /cok programli anadolu lisesi$/ },
  { label: 'Anadolu İmam Hatip Lisesi', pattern: /anadolu imam hatip lisesi$/ },
  { label: 'İmam Hatip Ortaokulu', pattern: /imam hatip ortaokulu$/ },
  { label: 'Mesleki ve Teknik Anadolu Lisesi', pattern: /mesleki ve teknik anadolu lisesi$/ },
  { label: 'Sosyal Bilimler Lisesi', pattern: /sosyal bilimler lisesi$/ },
  { label: 'Güzel Sanatlar Lisesi', pattern: /guzel sanatlar lisesi$/ },
  { label: 'Spor Lisesi', pattern: /spor lisesi$/i },
  { label: 'Fen Lisesi', pattern: /fen lisesi$/ },
  { label: 'Anadolu Lisesi', pattern: /anadolu lisesi$/ },
  { label: 'Açık Öğretim Lisesi', pattern: /acik ogretim lisesi$/ },
  { label: 'Anaokulu', pattern: /anaokulu$/ },
  { label: 'İlkokulu', pattern: /ilkokulu$/ },
  { label: 'Ortaokulu', pattern: /ortaokulu$/ },
  { label: 'Lise', pattern: /lisesi$/ },
];

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** MEB okul dizini: büyük illerde tablo çizimi ve HTTP istekleri uzun sürebilir */
const MEB_NAV_TIMEOUT_MS = 180_000;
const MEB_PLAYWRIGHT_DEFAULT_MS = 600_000;
const MEB_DATATABLE_READY_MS = 420_000;
const MEB_DETAIL_FETCH_MS = 55_000;

@Injectable()
export class MebbisKurumlistesiService {
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

  getIlOptions() {
    return { items: MEBBIS_IL_OPTIONS.filter((x) => x.value !== '999') };
  }

  async getIlceOptions(dto: MebbisIlceQueryDto): Promise<{ items: { label: string }[] }> {
    const il = MEBBIS_IL_OPTIONS.find((x) => x.value === dto.il_kodu);
    if (!il) throw new BadRequestException({ code: 'INVALID_IL', message: 'Geçersiz il kodu.' });

    const pw = await this.loadPlaywright();
    const browser = await pw.chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(MEB_PLAYWRIGHT_DEFAULT_MS);
      page.setDefaultNavigationTimeout(MEB_NAV_TIMEOUT_MS);
      await this.preparePublicListPage(page, dto.il_kodu);
      const labels = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('#icerik-listesi tbody tr'));
        return rows
          .map((tr) => {
            const text = (tr.querySelector('td a')?.textContent || '').trim();
            const parts = text.split(' - ').map((x) => x.trim()).filter(Boolean);
            return parts.length >= 3 ? parts[1] : '';
          })
          .filter(Boolean);
      });
      const uniq = [...new Set(labels)].sort((a, b) => a.localeCompare(b, 'tr'));
      return { items: uniq.map((label) => ({ label })) };
    } finally {
      await browser.close();
    }
  }

  async getTypeOptions(dto: MebbisTypeQueryDto): Promise<{ items: { label: string; value: string }[] }> {
    const il = MEBBIS_IL_OPTIONS.find((x) => x.value === dto.il_kodu);
    if (!il) throw new BadRequestException({ code: 'INVALID_IL', message: 'Geçersiz il kodu.' });

    const pw = await this.loadPlaywright();
    const browser = await pw.chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(MEB_PLAYWRIGHT_DEFAULT_MS);
      page.setDefaultNavigationTimeout(MEB_NAV_TIMEOUT_MS);
      await this.preparePublicListPage(page, dto.il_kodu);
      const rawRows = await this.readPublicRows(page);
      const items = [...new Set(
        rawRows
          .map((row) => this.parsePublicRowTitle(row.title))
          .filter(
            (parsed): parsed is { city: string; district: string; name: string } =>
              !!parsed &&
              this.normalizeText(parsed.city) === this.normalizeText(il.label) &&
              this.normalizeText(parsed.district) === this.normalizeText(dto.ilce_label),
          )
          .map((parsed) => this.inferPublicInstitutionTypeLabel(parsed.name))
          .filter((value): value is string => !!value),
      )].sort((a, b) => a.localeCompare(b, 'tr'));
      return { items: items.map((label) => ({ label, value: label })) };
    } finally {
      await browser.close();
    }
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

    const pw = await this.loadPlaywright();
    const browser = await pw.chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(MEB_PLAYWRIGHT_DEFAULT_MS);
      page.setDefaultNavigationTimeout(MEB_NAV_TIMEOUT_MS);
      await this.preparePublicListPage(page, dto.il_kodu);
      const rawRows = await this.readPublicRows(page);

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
    } finally {
      await browser.close();
    }
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

  private inferPublicInstitutionTypeLabel(name: string): string | null {
    const normalizedName = this.normalizeText(name);
    if (!normalizedName) return null;
    for (const candidate of PUBLIC_INSTITUTION_TYPE_PATTERNS) {
      if (candidate.pattern.test(normalizedName)) return candidate.label;
    }
    return null;
  }

  private inferSchoolTypeFilter(rawFilter: string): SchoolType | null {
    const filter = this.normalizeText(rawFilter);
    if (!filter) return null;
    if ((Object.values(SchoolType) as string[]).includes(rawFilter)) return rawFilter as SchoolType;
    if (filter.includes('anaokul')) return SchoolType.anaokul;
    if (filter.includes('ilkokul')) return SchoolType.ilkokul;
    if (filter.includes('ortaokul') && !filter.includes('imam')) return SchoolType.ortaokul;
    if (filter.includes('imam') && filter.includes('orta')) return SchoolType.imam_hatip_ortaokul;
    if (filter.includes('imam') && (filter.includes('lise') || filter.includes('lis'))) return SchoolType.imam_hatip_lise;
    if (filter.includes('meslek') || filter.includes('mtal') || filter.includes('mesleki')) return SchoolType.meslek_lisesi;
    if (filter.includes('bilsem')) return SchoolType.bilsem;
    if (filter.includes('halk') && filter.includes('egitim')) return SchoolType.halk_egitim;
    if (filter.includes('ozel egitim')) return SchoolType.ozel_egitim;
    if (filter.includes('fen lisesi') || filter.includes('fenlisesi')) return SchoolType.fen_lisesi;
    if (filter.includes('sosyal bilim')) return SchoolType.sosyal_bilimler_lisesi;
    if (filter.includes('anadolu') && filter.includes('cok')) return SchoolType.cok_programli_anadolu_lisesi;
    if (filter.includes('anadolu')) return SchoolType.anadolu_lisesi;
    if (filter.includes('acik ogretim')) return SchoolType.acik_ogretim_lisesi;
    if (filter.includes('guzel sanat')) return SchoolType.guzel_sanatlar_lisesi;
    if (filter.includes('spor lise')) return SchoolType.spor_lisesi;
    if (filter.includes('temel egitim')) return SchoolType.temel_egitim;
    if (filter.includes('lise')) return SchoolType.lise;
    return null;
  }

  private matchesTypeFilter(name: string, rawFilter: string): boolean {
    const filter = this.normalizeText(rawFilter);
    if (!filter) return true;
    const inferredPublicType = this.inferPublicInstitutionTypeLabel(name);
    if (inferredPublicType && this.normalizeText(inferredPublicType) === filter) return true;
    const inferredFilterType = this.inferSchoolTypeFilter(rawFilter);
    const inferredNameType = mapTypeLabel(name);
    if (inferredFilterType) return inferredFilterType === inferredNameType;
    return this.normalizeText(name).includes(filter);
  }

  /** DataTables tüm satırları çizene kadar bekle (uzun illerde kısa sleep yetersiz kalıyordu). */
  private async waitForPublicDataTableRowsReady(page: import('playwright').Page, timeoutMs: number): Promise<void> {
    try {
      await page.waitForFunction(
        () => {
          const jq = (window as unknown as { jQuery?: (sel: string) => any }).jQuery;
          if (!jq) return false;
          const $t = jq('#icerik-listesi');
          if (!$t.length) return false;
          const wrap = $t.closest('.dataTables_wrapper');
          if (wrap.find('.dataTables_processing:visible').length) return false;
          const dt = $t.DataTable?.();
          if (!dt) return false;
          const info = dt.page.info();
          const target = Math.max(info.recordsTotal ?? 0, info.recordsDisplay ?? 0);
          const rows = document.querySelectorAll('#icerik-listesi tbody tr').length;
          if (target <= 0) return rows >= 1;
          return rows >= target;
        },
        { timeout: timeoutMs, polling: 500 },
      );
    } catch {
      await sleep(12_000);
    }
  }

  private async preparePublicListPage(page: import('playwright').Page, ilKodu: string) {
    await page.goto(PUBLIC_MEB_SCHOOLS_URL, {
      waitUntil: 'domcontentloaded',
      timeout: MEB_NAV_TIMEOUT_MS,
    });
    await page.selectOption('#ILADI', ilKodu);
    await sleep(2800);
    await page.evaluate(() => {
      const jq = (window as typeof window & { jQuery?: CallableFunction }).jQuery as any;
      const dt = jq?.('#icerik-listesi')?.DataTable?.();
      if (!dt) return;
      const info = dt.page.info();
      const total = Math.max(info.recordsTotal ?? 0, info.recordsDisplay ?? 0, 100);
      const want = Math.min(Math.max(total, 100), 25_000);
      try {
        dt.page.len(want).draw(false);
      } catch {
        try {
          dt.page.len(-1).draw(false);
        } catch {
          dt.page.len(10_000).draw(false);
        }
      }
    });
    await this.waitForPublicDataTableRowsReady(page, MEB_DATATABLE_READY_MS);
    await sleep(600);
  }

  private async readPublicRows(page: import('playwright').Page): Promise<
    Array<{ title: string; website_url: string | null; about_url: string | null; map_url: string | null }>
  > {
    return page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#icerik-listesi tbody tr'));
      return rows.map((tr) => {
        const links = Array.from(tr.querySelectorAll('a'));
        return {
          title: (links[0]?.textContent || '').trim(),
          website_url: (links[0] as HTMLAnchorElement | undefined)?.href || null,
          about_url: (links[1] as HTMLAnchorElement | undefined)?.href || null,
          map_url: (links[2] as HTMLAnchorElement | undefined)?.href || null,
        };
      });
    });
  }

  private parsePublicRowTitle(title: string): { city: string; district: string; name: string } | null {
    const parts = title
      .split(' - ')
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
