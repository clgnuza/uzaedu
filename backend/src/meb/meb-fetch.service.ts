import { BadRequestException, Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getTymmFetchUrl, getTymmAvailableSubjectCodes, TYMM_TASLAK_PLAN_URLS, SUBJECT_LABELS } from '../config/meb-sources';
import { getDersSaatiStatic } from '../config/ders-saati';
import * as XLSX from 'xlsx';

export interface ParsedPlanRow {
  week_order: number;
  unite: string | null;
  konu: string | null;
  kazanimlar: string | null;
  ders_saati: number;
  belirli_gun_haftalar: string | null;
  surec_bilesenleri?: string | null;
  olcme_degerlendirme?: string | null;
  sosyal_duygusal?: string | null;
  degerler?: string | null;
  okuryazarlik_becerileri?: string | null;
  zenginlestirme?: string | null;
  okul_temelli_planlama?: string | null;
}

export interface ImportMebTaslakResult {
  imported: number;
  grade: number;
  subject_code: string;
  subject_label: string;
  academic_year: string;
  warnings: string[];
}

/** Sütun adı eşlemesi – farklı Excel formatlarına uyum (TYMM, Temel Eğitim varyantları).
 * Öncelik: 'öğrenme' tek başına kazanım ile eşleşmesin diye sosyal-duygusal / okuryazarlık,
 * ölçme sütunları kazanımdan önce gelir (Object.entries sırası = ilk eşleşen kazanır). */
const COL_ALIASES: Record<string, string[]> = {
  // 'no' tek başına kullanılmasın: "Ünite No" gibi başlıklar yanlışlıkla hafta sütunu sayılıyordu
  week_order: ['hafta', 'hafteno', 'hafta no', 'hafta no.', 'sıra', 'sira', 'sıra no', 'week', 'weeks'],
  unite: [
    'ünite', 'unite', 'ünite/tema', 'ünite / tema', 'ünite tema', 'tema', 'tema/ünite', 'unit',
    'ünite ve tema', 'unite ve tema', 'theme', 'unit/theme', 'theme/unit',
  ],
  konu: [
    'konu', 'işlenen konu', 'islenen konu', 'içerik çerçevesi', 'icerik cercevesi',
    'içerik', 'icerik', 'konu içeriği', 'işlenecek konu',
    'functions', 'language functions', 'communicative functions', 'topics', 'content',
  ],
  belirli_gun_haftalar: [
    'belirli gün ve haftalar', 'belirli gun', 'belirli gun ve haftalar',
    'belirli gün', 'özel gün', 'belirli gün ve h.', 'b.g. ve h.', 'bel. gün',
    'special days', 'special days and weeks',
  ],
  sosyal_duygusal: [
    'sosyal duygusal', 'sosyal-duygusal', 'sosyal duygusal öğrenme',
    'sosyal ve duygusal', 'sosyal-duygusal öğrenme',
    'sos.-duyg.', 'sos. duyg.', 'sos duyg', 'sosyal-duyg',
  ],
  olcme_degerlendirme: [
    'ölçme ve değerlendirme', 'olcme degerlendirme', 'ölçme değerlendirme',
    'ölçme', 'olcme', 'değerlendirme', 'degerlendirme',
    'materials', 'tools and materials', 'assessment',
  ],
  okuryazarlik_becerileri: [
    'okuryazarlık', 'okuryazarlik', 'okur yazarlık', 'okuryazarlık becerileri',
    'okur yazarlik',
    'okuryaz',
  ],
  kazanimlar: [
    'kazanımlar', 'kazanimlar', 'öğrenme çıktıları', 'ogrenme ciktilari',
    'öğrenme çıkt', 'ogrenme cikt',
    'kazanim', 'öğrenme çıktısı',
    'öğrenme çıktısı', 'ogrenme ciktisi', 'kazanım',
    'learning outcomes', 'learning outcome', 'outcomes', 'students will be able',
  ],
  ders_saati: ['ders saati', 'derssaati', 'saat', 'toplam saat', 'hour', 'hours'],
  surec_bilesenleri: [
    'süreç bileşenleri', 'surec bilesenleri', 'süreç bileşen', 'süreç bileş', 'surec biles',
    'süreç', 'programlar arası',
    'tymm süreç', 'surec',
    'language skills', 'skills',
  ],
  degerler: ['değerler', 'degerler', 'değer'],
  zenginlestirme: [
    'zenginleştirme',
    'zenginlestirme',
    'zenginleştirme etkinlikleri',
    'farklılaştırma',
    'farklilastirma',
    'farklılaştırma etkinlikleri',
    'farklıl',
    'farklil',
    'farklılas',
    'farklilas',
  ],
  okul_temelli_planlama: [
    'okul temelli', 'okul temelli planlama', 'okul temelli planlama ve uygulama',
    'okul temelli planlama ve uygulamalar', 'okul plan', 'in-class adaptations', 'adaptations',
  ],
};

@Injectable()
export class MebFetchService {
  /**
   * "10 - 14 Kasım", "16 - 20 Mart" ve "19 Ocak - 30 Ocak" gibi: ilk sayı gün/hafta no değil
   * (BİLSEM şablonu ilk rakamı yanlışlıkla week_order alıyordu).
   */
  private cellLeadingNumberIsFakeWeek(s: string): boolean {
    const t = s.replace(/\r\n/g, ' ').trim();
    if (!t) return false;
    if (/\d+\s*\.\s*Hafta/i.test(t)) return false;
    if (/\bHafta\s*:/i.test(t)) return false;
    if (/^\d{1,2}\s*[-–—]\s*\d{1,2}\s+/.test(t) && /(Kasım|Kasim|ocak|şubat|mart|nisan|Nisan|may|haz|temmuz|ağustos|eyl|ekim|aral|Mayıs|Haziran)/i.test(t)) {
      return true;
    }
    if (
      /^\d{1,2}\s+(Oca|Şub|Mar|Nis|May|Haz|Tem|Ağu|Eyl|Ekim|Kasım|Kasim|Aral|Ocak|Şubat|Nisan|Mart|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık)/i.test(
        t,
      )
    ) {
      if (/\bHafta\b/i.test(t)) return false;
      return /[-–—]/.test(t);
    }
    return false;
  }

  /** Ara tatil / yarıyıl satırı (N. Hafta yok; sadece tarih aralığı + ay adı). */
  private isBilsemTatilHaftaLine(haftaText: string): boolean {
    const t = String(haftaText ?? '')
      .replace(/\r\n/g, ' ')
      .trim();
    if (!t) return false;
    if (/\b(tatil|yarıyıl|yariyil|dönem\s*ara|donem\s*ara|karne|bayram|resm[iî]\s*tatil)\b/i.test(t)) return true;
    if (/\d+\s*\.\s*Hafta/i.test(t)) return false;
    if (this.cellLeadingNumberIsFakeWeek(t)) return true;
    if (
      /^\d{1,2}\s*[-–—]\s*\d{1,2}\b/.test(t) &&
      !/Hafta/i.test(t) &&
      /(Kasım|Kasim|ocak|Ocak|Mart|Nisan|mart|Nisan|May|may)/i.test(t)
    ) {
      return true;
    }
    return false;
  }

  private extractInlineWeekOrder(text: string | number | null | undefined): number | null {
    const s = String(text ?? '').trim();
    if (!s) return null;
    const patterns = [
      /^week\s*(\d{1,2})\b/i,
      /\bweek\s*(\d{1,2})\b/i,
      /^hafta\s*(\d{1,2})\b/i,
      /\bhafta\s*(\d{1,2})\b/i,
      /^(\d{1,2})\.\s*hafta\b/i,
      /^(\d{1,2})\.\s*week\b/i,
    ];
    for (const pattern of patterns) {
      const match = s.match(pattern);
      if (!match) continue;
      const value = parseInt(match[1], 10);
      if (value >= 1 && value <= 38) return value;
    }
    return null;
  }

  private stripWeekAndDateArtifacts(text: string | null | undefined): string | null {
    const raw = String(text ?? '').trim();
    if (!raw) return null;
    const cleaned = raw
      .replace(/\bweek\s*\d{1,2}\s*:?\s*/gi, '')
      .replace(/\b\d{1,2}\.\s*week\s*:?\s*/gi, '')
      .replace(/\bhafta\s*\d{1,2}\s*:?\s*/gi, '')
      .replace(/\b\d{1,2}\.\s*hafta\s*:?\s*/gi, '')
      .replace(/\b\d{1,2}\s*[-/]\s*\d{1,2}\s+(january|february|march|april|may|june|july|august|september|october|november|december)\b/gi, '')
      .replace(/\b\d{1,2}\s*[-/]\s*\d{1,2}\s+(ocak|subat|şubat|mart|nisan|mayis|mayıs|haziran|temmuz|agustos|ağustos|eylul|eylül|ekim|kasim|kasım|aralik|aralık)\b/gi, '')
      .replace(/\n{2,}/g, '\n')
      .trim();
    return cleaned || null;
  }

  private normalizeForMatch(value: string): string {
    return String(value ?? '')
      .toLocaleLowerCase('tr-TR')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  /** TYMM ölçme şablonu metni yanlışlıkla ünite/konu/kazanım hücresine yapışmışsa ayırt etmek için */
  private looksLikeOlcmeTemplateBlock(s: string): boolean {
    const t = String(s).trim().toLowerCase();
    if (!t) return false;
    if (t.includes('bu ünitenin ölçme') || t.includes('bu ünitenin olcme')) return true;
    if (/öğrenme çıktıları\s*[;:]\s*kontrol|ogrenme ciktilari\s*[;:]\s*kontrol/i.test(t)) return true;
    if (t.includes('kontrol listesi') && /dereceleme|dereceli|bütüncül|butuncul|bütün|butun/i.test(t))
      return true;
    if (t.startsWith('*') && /kontrol|dereceleme|bütüncül|butuncul|ölçek|olcek/i.test(t)) return true;
    return false;
  }

  private extractOlcmeFromField(text: string | null): { rest: string | null; olcme: string | null } {
    if (!text?.trim()) return { rest: null, olcme: null };
    const full = text.trim();
    if (this.looksLikeOlcmeTemplateBlock(full)) return { rest: null, olcme: full };
    const lines = text.split(/\r?\n/);
    const kept: string[] = [];
    const olcme: string[] = [];
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      if (this.looksLikeOlcmeTemplateBlock(line)) {
        olcme.push(line);
        continue;
      }
      if (line.startsWith('*') && /kontrol|dereceleme|bütüncül|butuncul|ölçek|olcek/i.test(line)) {
        olcme.push(line);
        continue;
      }
      kept.push(line);
    }
    return {
      rest: kept.length ? kept.join('\n') : null,
      olcme: olcme.length ? olcme.join('\n') : null,
    };
  }

  private extractSdbLinesFromKazanim(text: string | null): { rest: string | null; sdb: string | null } {
    if (!text?.trim()) return { rest: null, sdb: null };
    const lines = text.split(/\r?\n/);
    const kept: string[] = [];
    const sdb: string[] = [];
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      if (/^SDB\d/i.test(line) || /^DB\d/i.test(line)) sdb.push(line);
      else kept.push(line);
    }
    return {
      rest: kept.length ? kept.join('\n') : null,
      sdb: sdb.length ? sdb.join('\n') : null,
    };
  }

  /** Okuryazarlık kodları (OB1., OB2.) yanlışlıkla kazanım/konu içinde kalmışsa ayırmak için */
  private extractObLinesFromText(text: string | null): { rest: string | null; ob: string | null } {
    if (!text?.trim()) return { rest: null, ob: null };
    const lines = text.split(/\r?\n/);
    const kept: string[] = [];
    const ob: string[] = [];
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      const obHits = line.match(/\bOB\d+\./gi) ?? [];
      if (obHits.length > 1 && line.includes(',')) {
        for (const ch of line.split(',')) {
          const t = ch.trim();
          if (!t) continue;
          if (/^OB\d+\./i.test(t)) ob.push(t);
          else kept.push(t);
        }
        continue;
      }
      if (/^OB\d+\./i.test(line) || /^OB\d+\s/i.test(line) || /^OB\d+$/i.test(line)) ob.push(line);
      else kept.push(line);
    }
    return {
      rest: kept.length ? kept.join('\n') : null,
      ob: ob.length ? ob.join('\n') : null,
    };
  }

  /** Parse sonrası: ölçme şablonunu çekirdek alanlardan olcme_degerlendirme'e; SDB satırlarını sürece taşı */
  private redistributeMisplacedPlanFields(row: ParsedPlanRow): ParsedPlanRow {
    const out: ParsedPlanRow = { ...row };
    const olcmeChunks: string[] = [];
    const surecChunks: string[] = [];
    const obChunks: string[] = [];

    for (const f of ['unite', 'konu', 'kazanimlar'] as const) {
      const v = out[f];
      if (!v) continue;
      const { rest, olcme } = this.extractOlcmeFromField(v);
      if (olcme) {
        olcmeChunks.push(olcme);
        const next = rest?.trim() || null;
        if (f === 'unite') out.unite = next;
        else if (f === 'konu') out.konu = next;
        else out.kazanimlar = next;
      }
    }

    for (const f of ['kazanimlar', 'konu', 'unite'] as const) {
      const v = out[f];
      if (!v) continue;
      const { rest, ob } = this.extractObLinesFromText(v);
      if (ob) {
        obChunks.push(ob);
        const next = rest?.trim() || null;
        if (f === 'unite') out.unite = next;
        else if (f === 'konu') out.konu = next;
        else out.kazanimlar = next;
      }
    }

    if (out.kazanimlar) {
      const { rest, sdb } = this.extractSdbLinesFromKazanim(out.kazanimlar);
      if (sdb) {
        out.kazanimlar = rest?.trim() || null;
        surecChunks.push(sdb);
      }
    }

    if (olcmeChunks.length) {
      out.olcme_degerlendirme = [out.olcme_degerlendirme, ...olcmeChunks].filter(Boolean).join('\n') || null;
    }
    if (surecChunks.length) {
      out.surec_bilesenleri = [out.surec_bilesenleri, ...surecChunks].filter(Boolean).join('\n') || null;
    }
    if (obChunks.length) {
      out.okuryazarlik_becerileri = [out.okuryazarlik_becerileri, ...obChunks].filter(Boolean).join('\n') || null;
    }
    return out;
  }

  /**
   * Maarif/TYMM: Ana öğrenme çıktısı bir sütunda (BES.9.x.x …), a) b) alt maddeleri yanlışlıkla
   * "süreç bileşenleri" sütununa yazılmışsa kazanıma birleştir (SDB/DB kodu yoksa).
   */
  private mergeKazanimSubitemsMisplacedInSurec(row: ParsedPlanRow): ParsedPlanRow {
    const out = { ...row };
    const k = String(out.kazanimlar ?? '').trim();
    const s = String(out.surec_bilesenleri ?? '').trim();
    if (!s) return out;
    if (/\b(SDB|DB)\d/i.test(s)) return out;
    const firstLine = s.split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? '';
    if (!/^[a-zçğıöşü]\)\s/i.test(firstLine)) return out;
    out.kazanimlar = k ? `${k}\n${s}` : s;
    out.surec_bilesenleri = null;
    return out;
  }

  /**
   * Aynı kalıp ölçme sütununa kaymışsa (yine a) ile başlıyorsa, klasik ölçme anahtar kelimesi yoksa).
   */
  private mergeKazanimSubitemsMisplacedInOlcme(row: ParsedPlanRow): ParsedPlanRow {
    const out = { ...row };
    const k = String(out.kazanimlar ?? '').trim();
    const o = String(out.olcme_degerlendirme ?? '').trim();
    if (!o || !k) return out;
    if (/\b(SDB|DB)\d/i.test(o)) return out;
    if (
      /\b(ölçüt|puan|rubric|performans görevi|çalışma yaprağı|ölçme ve değerlendirme|kontrol listesi|dereceleme|gözlem formu)\b/i.test(
        o,
      )
    ) {
      return out;
    }
    const firstLine = o.split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? '';
    if (!/^[a-zçğıöşü]\)\s/i.test(firstLine)) return out;
    out.kazanimlar = `${k}\n${o}`;
    out.olcme_degerlendirme = null;
    return out;
  }

  private getProgramHint(subjectCode?: string): 'fen_lisesi' | null {
    const lower = String(subjectCode ?? '').toLocaleLowerCase('tr-TR');
    if (/(?:^|_)(fl|fen_lisesi)(?:_|$)/.test(lower)) return 'fen_lisesi';
    return null;
  }

  private isFenLisesiText(value: string): boolean {
    const n = this.normalizeForMatch(value);
    return (
      n.includes('fen lisesi') ||
      n.includes('fenlisesi') ||
      /\bf\.?\s*l\.?\b/.test(n)
    );
  }

  private filterNamesByProgram<T extends string>(names: T[], subjectCode?: string): T[] {
    const hint = this.getProgramHint(subjectCode);
    if (hint === 'fen_lisesi') {
      const filtered = names.filter((n) => this.isFenLisesiText(n));
      if (filtered.length > 0) return filtered;
    }
    return names;
  }

  private getSubjectTokens(subjectCode?: string): string[] {
    const lower = String(subjectCode ?? '').toLocaleLowerCase('tr-TR').trim();
    const base = lower.replace(/_maarif.*$/, '');
    return base
      .split('_')
      .map((t) => this.normalizeForMatch(t))
      .filter((t) => t.length >= 3);
  }

  private scoreNameForSubject(name: string, subjectCode?: string): number {
    const normalized = this.normalizeForMatch(name);
    const tokens = this.getSubjectTokens(subjectCode);
    let score = 0;
    for (const token of tokens) {
      if (normalized.includes(token)) score += 20;
    }
    return score;
  }

  private scoreRows(rows: ParsedPlanRow[]): number {
    if (!rows.length) return -1000;
    const byWeek = new Map<number, ParsedPlanRow>(rows.map((r) => [r.week_order, r]));
    const week1 = byWeek.get(1);
    let score = 0;
    if (week1) {
      score += 80;
      if (week1.unite?.trim()) score += 20;
      if (week1.konu?.trim()) score += 20;
      if (week1.kazanimlar?.trim()) score += 30;
      if (Number.isFinite(Number(week1.ders_saati))) score += 10;
    }
    if (byWeek.has(2)) score += 10;
    if (byWeek.has(3)) score += 10;

    // 1. haftadan başlayan kesintisiz dizi ne kadar uzunsa o kadar güvenli.
    let consecutive = 0;
    for (let w = 1; w <= 38; w++) {
      if (byWeek.has(w)) consecutive++;
      else break;
    }
    score += Math.min(40, consecutive);
    score += Math.min(30, rows.length);
    return score;
  }

  /**
   * TYMM RAR indir, çıkar; tempDir ve Excel yollarını döndür (cleanup çağıran yapmalı).
   */
  async fetchRarAndExtract(params: {
    subject_code: string;
    grade: number;
  }): Promise<{ tempDir: string; xlsxPaths: string[] }> {
    const url =
      getTymmFetchUrl(params.subject_code, params.grade) ??
      TYMM_TASLAK_PLAN_URLS[params.subject_code];
    if (!url) {
      throw new BadRequestException({
        code: 'MEB_SUBJECT_NOT_FOUND',
        message: `TYMM taslak planı bu ders/sınıf için tanımlı değil: ${params.subject_code} ${params.grade}. Sınıf.`,
      });
    }
    const res = await fetch(url, {
      headers: { 'User-Agent': 'UzaeduOgretmen/1.0 (MEB müfredat senkronizasyonu)' },
      signal: AbortSignal.timeout(90000),
    });
    if (!res.ok) {
      throw new BadRequestException({
        code: 'MEB_FETCH_FAILED',
        message: `TYMM dosyası indirilemedi: ${res.status} ${res.statusText}`,
      });
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const tempDir = path.join(os.tmpdir(), `meb-${params.subject_code}-${Date.now()}`);
    const rarPath = path.join(tempDir, 'plan.rar');
    fs.mkdirSync(tempDir, { recursive: true });
    fs.writeFileSync(rarPath, buffer);
    const extractPath = path.join(tempDir, 'extract');
    fs.mkdirSync(extractPath, { recursive: true });

    const { createExtractorFromFile } = require('node-unrar-js');
    const extractor = await createExtractorFromFile({
      filepath: rarPath,
      targetPath: extractPath,
    });
    const extracted = extractor.extract();
    const fileList = extracted?.files ? [...extracted.files] : [];
    if (fileList.length === 0) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
      throw new BadRequestException({
        code: 'MEB_RAR_EMPTY',
        message: 'RAR dosyası boş veya çıkarılamadı.',
      });
    }

    const xlsxPaths = this.findXlsxFiles(extractPath, params.grade);
    if (xlsxPaths.length === 0) {
      const names = fileList
        .map((f: { fileHeader?: { name?: string } }) => f.fileHeader?.name ?? '')
        .filter(Boolean)
        .join(', ');
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
      throw new BadRequestException({
        code: 'MEB_NO_EXCEL',
        message: `RAR içinde ${params.grade}. sınıf için Excel dosyası bulunamadı. Bulunan: ${names || '(liste yok)'}`,
      });
    }
    return { tempDir, xlsxPaths };
  }

  /** Excel dosyasından satır bazlı parse (public – controller veya GPT fallback için). grade ile çok sayfalı Excel'de doğru sayfa seçilir. */
  parseExcelPlan(
    filePath: string,
    grade?: number,
    subjectCode?: string,
    targetSheetName?: string,
  ): { items: ParsedPlanRow[]; planNotu: string | null } {
    return this.parseExcelPlanInternal(filePath, grade, subjectCode, targetSheetName);
  }

  /** Excel dosyasındaki sayfa isimlerini döndürür (manuel seçim için) */
  getExcelSheetNames(filePath: string): string[] {
    try {
      const wb = XLSX.readFile(filePath, { cellDates: false });
      return wb.SheetNames || [];
    } catch {
      return [];
    }
  }

  /**
   * TYMM taslak plan RAR'ını indir, çıkar, Excel'den parse et.
   * Temel Eğitim (1-8) ve Ortaöğretim (9-12) desteklenir.
   * Kaynak: https://tymm.meb.gov.tr/taslak-cerceve-planlari
   */
  async fetchAndParseTymmTaslak(params: {
    subject_code: string;
    grade: number;
    academic_year: string;
  }): Promise<ParsedPlanRow[]> {
    let tempDir: string | null = null;
    try {
      const { tempDir: td, xlsxPaths } = await this.fetchRarAndExtract(params);
      tempDir = td;
      const prioritizedPaths = this.filterNamesByProgram(xlsxPaths, params.subject_code);
      let bestRows: ParsedPlanRow[] = [];
      let bestScore = -100000;
      for (const xlsxPath of prioritizedPaths) {
        const { items } = this.parseExcelPlanInternal(xlsxPath, params.grade, params.subject_code);
        const score =
          this.scoreRows(items) +
          this.scoreNameForSubject(path.basename(xlsxPath), params.subject_code);
        if (score > bestScore) {
          bestScore = score;
          bestRows = items;
        }
      }
      return bestRows;
    } finally {
      if (tempDir) {
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {
          /* ignore */
        }
      }
    }
  }

  private findXlsxFiles(extractPath: string, grade: number): string[] {
    const found: string[] = [];
    const walk = (dir: string) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const e of entries) {
          const full = path.join(dir, e.name);
          if (e.isDirectory()) walk(full);
          else if (e.name.toLowerCase().endsWith('.xlsx') || e.name.toLowerCase().endsWith('.xls')) {
            const gradeMatch = e.name.match(/(\d+)/);
            if (gradeMatch && parseInt(gradeMatch[1], 10) === grade) found.push(full);
            else if (!gradeMatch && found.length === 0) found.push(full);
          }
        }
      } catch {
        /* skip */
      }
    };
    walk(extractPath);
    if (found.length === 0) {
      const all: string[] = [];
      const walkAll = (dir: string) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const e of entries) {
          const full = path.join(dir, e.name);
          if (e.isDirectory()) walkAll(full);
          else if (e.name.toLowerCase().endsWith('.xlsx') || e.name.toLowerCase().endsWith('.xls')) {
            all.push(full);
          }
        }
      };
      walkAll(extractPath);
      return all.slice(0, 1);
    }
    return found;
  }

  /** TYMM/SBL Excel'de üstte başlık/ay satırları olabilir; ilk 10 satırda en çok sütun anahtar kelimesi taşıyan satır. */
  private findHeaderRowIndex(json: unknown[][]): number {
    const headerKeywords = [
      'hafta',
      'ünite',
      'unite',
      'konu',
      'kazanım',
      'kazanim',
      'öğrenme',
      'ogrenme',
      'saat',
      'ölçme',
      'olcme',
      'süreç',
      'surec',
      'sosyal',
      'okuryaz',
      'belirli gün',
      'belirli gun',
      'week',
      'theme',
      'outcomes',
    ];
    const normalize = (s: string) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
    let bestIdx = 0;
    let bestScore = 0;
    for (let rowIdx = 0; rowIdx < Math.min(10, json.length); rowIdx++) {
      const row = json[rowIdx];
      if (!row) continue;
      const cells = Array.isArray(row) ? row : Object.values(row);
      const concat = cells.map((c) => normalize(String(c ?? ''))).join(' ');
      const matchCount = headerKeywords.filter((kw) => concat.includes(kw)).length;
      if (matchCount >= 2) {
        const hasHafta = concat.includes('hafta') || /\bweek\b/.test(concat);
        const hasUniteOrKonu = concat.includes('ünite') || concat.includes('unite') || concat.includes('konu');
        const score = matchCount * 2 + (hasHafta ? 10 : 0) + (hasUniteOrKonu ? 4 : 0);
        // Aynı skorda alttaki satır: üstte talimat/özet, 2–3. satır gerçek tablo başlığı (veri genelde 4. satırdan).
        if (score > bestScore || (score === bestScore && rowIdx > bestIdx)) {
          bestScore = score;
          bestIdx = rowIdx;
        }
      }
    }
    return bestIdx;
  }

  /** Birleştirilmiş başlık hücreleri: ana satır + üstteki 1–2 satır (boşta üstteki metin kullanılır). */
  private mergeHeaderRowsFromSheet(json: unknown[][], headerRowIndex: number): string[] {
    const rowLens = [headerRowIndex, headerRowIndex - 1, headerRowIndex - 2]
      .filter((i) => i >= 0)
      .map((i) => (Array.isArray(json[i]) ? json[i].length : 0));
    const maxLen = Math.min(40, Math.max(16, ...rowLens, 24));
    const merged: string[] = [];
    for (let idx = 0; idx < maxLen; idx++) {
      const main = String((json[headerRowIndex] as unknown[])?.[idx] ?? '').trim();
      const a1 = headerRowIndex > 0 ? String((json[headerRowIndex - 1] as unknown[])?.[idx] ?? '').trim() : '';
      const a2 = headerRowIndex > 1 ? String((json[headerRowIndex - 2] as unknown[])?.[idx] ?? '').trim() : '';
      merged[idx] = main || a1 || a2;
    }
    return merged;
  }

  /**
   * Çok sekmeli Excel'de grade ve subject'e uygun sheet adları.
   * Örnekler: "9. Sınıf", "1. Sınıf", "Coğrafya 9", "Plan 9", "9".
   * Eşleşme yoksa tüm sekmeler döner; parseExcelPlanInternal scoring ile en uygununu seçer.
   */
  getSheetNamesForGrade(wb: XLSX.WorkBook, grade: number): string[] {
    const names = wb.SheetNames || [];
    const gradeNum = grade;
    const matched: string[] = [];
    for (const name of names) {
      const lower = name.toLowerCase().replace(/ı/g, 'i');
      // "9. Sınıf", "9 Sınıf", "9.sınıf", "9.sinif" (ASCII)
      const sınıfMatch = lower.match(/(\d+)[.\s]*(?:sınıf|sinif)/);
      if (sınıfMatch && parseInt(sınıfMatch[1], 10) === gradeNum) {
        matched.push(name);
        continue;
      }
      // "9", "9.", "9 " ile başlayan
      const startMatch = lower.match(/^(\d+)[.\s]/);
      if (startMatch && parseInt(startMatch[1], 10) === gradeNum) {
        matched.push(name);
        continue;
      }
      // Word boundary ile grade: "Coğrafya 9", "Plan 9", "9 Coğrafya"
      const wordBoundary = new RegExp(`\\b${gradeNum}\\b`);
      if (wordBoundary.test(lower) || lower === String(gradeNum)) {
        matched.push(name);
      }
    }
    return matched.length > 0 ? matched : names;
  }

  /** Çok sayfalı TYMM Excel'de grade'e uygun sheet seç (geriye uyumluluk). */
  getSheetNameForGrade(wb: XLSX.WorkBook, grade: number): string | null {
    const names = this.getSheetNamesForGrade(wb, grade);
    return names[0] ?? null;
  }

  private parseExcelPlanInternal(
    filePath: string,
    grade?: number,
    subjectCode?: string,
    targetSheetName?: string,
  ): { items: ParsedPlanRow[]; planNotu: string | null } {
    const wb = XLSX.readFile(filePath, { cellDates: false });
    let sheetNames: string[] = [];

    if (targetSheetName && wb.SheetNames.includes(targetSheetName)) {
      sheetNames = [targetSheetName];
    } else {
      const sheetNamesByGrade =
        grade != null
          ? this.getSheetNamesForGrade(wb, grade)
          : [wb.SheetNames?.[0]].filter(Boolean) as string[];
      sheetNames = this.filterNamesByProgram(sheetNamesByGrade, subjectCode);
    }

    let bestRows: ParsedPlanRow[] = [];
    let bestPlanNotu: string | null = null;
    let bestScore = -100000;
    for (const sheetName of sheetNames) {
      const sheet = sheetName ? wb.Sheets[sheetName] : null;
      if (!sheet) continue;
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];
      if (json.length < 2) continue;

      const { items: sheetRows, planNotu: sheetNotu } = this.parseSheetToPlanRows(
        json,
        grade,
        subjectCode,
      );
      const score =
        this.scoreRows(sheetRows) +
        this.scoreNameForSubject(`${path.basename(filePath)} ${sheetName}`, subjectCode);
      if (score > bestScore) {
        bestScore = score;
        bestRows = sheetRows;
        bestPlanNotu = sheetNotu ?? null;
      }
    }

    return { items: bestRows, planNotu: bestPlanNotu };
  }

  private parseSheetToPlanRows(
    json: unknown[][],
    grade?: number,
    subjectCode?: string,
  ): { items: ParsedPlanRow[]; planNotu: string | null } {
    const defaultDersSaati =
      grade != null && subjectCode?.trim()
        ? getDersSaatiStatic(subjectCode.trim(), grade)
        : 2;
    const headerRowIndex = this.findHeaderRowIndex(json);
    const mergedArr = this.mergeHeaderRowsFromSheet(json, headerRowIndex);
    let colMap = this.buildColumnMap(mergedArr);
    const dataStartIndex = headerRowIndex + 1;
    const rows: (ParsedPlanRow & { _parseOrder: number })[] = [];
    let rowParseSeq = 0;
    let lastWeekOrder = 0;
    /** Sütunda birleştirilmiş satırlar: boş hücrede önceki satırdaki değeri kullan (merge taşıma) */
    let lastUnite = '';
    let lastKonu = '';
    let lastKazanim = '';
    let lastSurec = '';
    let lastOlcme = '';
    let lastSosyal = '';
    let lastDegerler = '';
    let lastOkuryazarlik = '';
    let lastBelirliGun = '';
    let lastZengin = '';
    let lastOkulTemelli = '';
    /** Hafta değişince sıfırlanır: farklılaştırma / okul temelli bir önceki haftadan taşınmasın */
    let lastProcessedWeekForCarry = -1;

    for (let i = dataStartIndex; i < json.length; i++) {
      const row = json[i] as unknown as Record<number, string | number>;

      if (this.looksLikeHeaderRow(row)) {
        const mergedInline = this.mergeHeaderRowsFromSheet(json, i);
        const newColMap = this.buildColumnMap(mergedInline);
        if (Object.keys(newColMap).length >= 2) colMap = newColMap;
        continue;
      }

      let weekOrder = this.extractWeekOrder(row, colMap, mergedArr);
      let rawKonu = this.getStr(row, colMap, 'konu') || '';
      let rawUnite = this.getStr(row, colMap, 'unite') || '';
      let rawKazanim = this.getStr(row, colMap, 'kazanimlar') || '';
      let rawSurec = this.getStr(row, colMap, 'surec_bilesenleri') || '';
      let rawOlcme = this.getStr(row, colMap, 'olcme_degerlendirme') || '';
      let rawSosyal = this.getStr(row, colMap, 'sosyal_duygusal') || '';
      let rawDegerler = this.getStr(row, colMap, 'degerler') || '';
      let rawOkuryazarlik = this.getStr(row, colMap, 'okuryazarlik_becerileri') || '';
      let rawBelirliGun = this.getStr(row, colMap, 'belirli_gun_haftalar') || '';
      let rawZengin = this.getStr(row, colMap, 'zenginlestirme') || '';
      let rawOkulTemelli = this.getStr(row, colMap, 'okul_temelli_planlama') || '';
      const haftaColIdx = colMap.week_order;
      const haftaForTatilCheck =
        haftaColIdx != null && haftaColIdx >= 0 ? String(row[haftaColIdx] ?? '').replace(/\r\n/g, ' ') : '';
      if (
        this.isBilsemTatilHaftaLine(haftaForTatilCheck) &&
        !rawUnite.trim() &&
        !rawKonu.trim() &&
        !rawKazanim.trim() &&
        !rawSurec.trim() &&
        !rawOlcme.trim()
      ) {
        continue;
      }
      // Hafta sütunu varken 1. hafta hücresi boş/birleşik olabiliyor; extract null kalınca sadece "hafta yok" dalı çalışmıyordu.
      if (weekOrder == null || weekOrder < 1 || weekOrder > 38) {
        const hasAnyRaw =
          !!(
            rawUnite.trim() ||
            rawKonu.trim() ||
            rawKazanim.trim() ||
            rawSurec.trim() ||
            rawOlcme.trim() ||
            rawSosyal.trim() ||
            rawDegerler.trim() ||
            rawOkuryazarlik.trim() ||
            rawBelirliGun.trim() ||
            rawZengin.trim() ||
            rawOkulTemelli.trim()
          );
        const mergeCont = this.isMergeContinuationRowNoHaftaColumn(
          rows,
          lastWeekOrder,
          rawUnite,
          rawKonu,
          rawKazanim,
          rawSurec,
          rawOlcme,
        );
        if (hasAnyRaw && !mergeCont) {
          if (rows.length === 0) {
            weekOrder = 1;
          } else if (!this.headersHaveAnyWeekColumn(mergedArr) && lastWeekOrder >= 1 && lastWeekOrder < 38) {
            weekOrder = lastWeekOrder + 1;
          }
        }
      }
      // İlk plan veri satırı = takvim 1. hafta (Excel satır sırası). Hafta sütunu ilk satırda 2,3… veya yanlış hücre sık okunuyor.
      if (rows.length === 0 && weekOrder != null && weekOrder >= 1 && weekOrder <= 38) {
        weekOrder = 1;
      }
      let validWeek = weekOrder != null && weekOrder >= 1 && weekOrder <= 38;
      if (validWeek && weekOrder != null && weekOrder !== lastProcessedWeekForCarry) {
        lastProcessedWeekForCarry = weekOrder;
        lastZengin = '';
        lastOkulTemelli = '';
      }
      // Hafta 1 numarası aşağıdaki satırdan okunabiliyor; içerik ilk veri satırından (≈ Excel 4. satır / F4) alınmalı.
      if (weekOrder === 1 && rows.length === 0 && i > dataStartIndex) {
        const base = json[dataStartIndex] as unknown as Record<number, string | number>;
        rawUnite = this.getStr(base, colMap, 'unite') || '';
        rawKonu = this.getStr(base, colMap, 'konu') || '';
        rawKazanim = this.getStr(base, colMap, 'kazanimlar') || '';
        rawSurec = this.getStr(base, colMap, 'surec_bilesenleri') || '';
        rawOlcme = this.getStr(base, colMap, 'olcme_degerlendirme') || '';
        rawSosyal = this.getStr(base, colMap, 'sosyal_duygusal') || '';
        rawDegerler = this.getStr(base, colMap, 'degerler') || '';
        rawOkuryazarlik = this.getStr(base, colMap, 'okuryazarlik_becerileri') || '';
        rawBelirliGun = this.getStr(base, colMap, 'belirli_gun_haftalar') || '';
        rawZengin = this.getStr(base, colMap, 'zenginlestirme') || '';
        rawOkulTemelli = this.getStr(base, colMap, 'okul_temelli_planlama') || '';
      }
      const uniteRawClean = this.stripWeekAndDateArtifacts(rawUnite);
      const konuRawClean = this.stripWeekAndDateArtifacts(rawKonu);
      const kazanimRawClean = this.stripWeekAndDateArtifacts(rawKazanim);
      const uniteCell = uniteRawClean || lastUnite;
      const konuCell = konuRawClean || lastKonu;
      const kazanimCell = kazanimRawClean || lastKazanim;
      const surecCell = rawSurec || lastSurec;
      const olcmeCell = rawOlcme || lastOlcme;
      const sosyalCell = rawSosyal || lastSosyal;
      const degerlerCell = rawDegerler || lastDegerler;
      const okuryazarlikCell = rawOkuryazarlik || lastOkuryazarlik;
      const belirliGunCell = rawBelirliGun || lastBelirliGun;
      const zenginCell = validWeek ? rawZengin || '' : rawZengin || lastZengin;
      const okulTemelliCell = validWeek ? rawOkulTemelli || '' : rawOkulTemelli || lastOkulTemelli;
      const fullText = `${uniteCell} ${konuCell} ${kazanimCell}`.toLowerCase();

      // Tablo altı dipnot / yorum satırları: veri satırı değil — atla (plan_notu'ya da yazma)
      if (
        (weekOrder == null || weekOrder < 1 || weekOrder > 38) &&
        this.looksLikeFootnote(fullText)
      ) {
        continue;
      }

      if (weekOrder == null || weekOrder < 1 || weekOrder > 38) {
        const hasAnyContent =
          !!(
            uniteCell ||
            konuCell ||
            kazanimCell ||
            surecCell ||
            olcmeCell ||
            sosyalCell ||
            degerlerCell ||
            okuryazarlikCell ||
            belirliGunCell ||
            zenginCell ||
            okulTemelliCell
          );
        if (!hasAnyContent) continue;

        // TYMM/SBL Excel: Önceki satır boş (SINAV, tatil vb.) ve bu satırda içerik varsa,
        // birleştirme yerine yeni hafta (lastWeekOrder+1) olarak ekle.
        const prevHasContent =
          rows.length > 0 &&
          (!!(rows[rows.length - 1].unite?.trim()) ||
            !!(rows[rows.length - 1].konu?.trim()) ||
            !!(rows[rows.length - 1].kazanimlar?.trim()));
        const currHasContent = !!(uniteCell?.trim() || konuCell?.trim() || kazanimCell?.trim());
        if (
          rows.length > 0 &&
          lastWeekOrder >= 1 &&
          lastWeekOrder < 38 &&
          !prevHasContent &&
          currHasContent
        ) {
          const nextWeek = lastWeekOrder + 1;
          lastWeekOrder = nextWeek;
          const parsedDersSaati = this.getNum(row, colMap, 'ders_saati');
          const normalizedDersSaati =
            parsedDersSaati != null
              ? parsedDersSaati
              : this.resolveMissingDersSaati(uniteCell, konuCell, kazanimCell, defaultDersSaati);
          const newRow: ParsedPlanRow & { _parseOrder: number } = {
            week_order: nextWeek,
            unite: uniteCell || null,
            konu: konuCell || null,
            kazanimlar: kazanimCell || null,
            ders_saati: normalizedDersSaati,
            belirli_gun_haftalar: belirliGunCell || null,
            surec_bilesenleri: surecCell || null,
            olcme_degerlendirme: olcmeCell || null,
            sosyal_duygusal: sosyalCell || null,
            degerler: degerlerCell || null,
            okuryazarlik_becerileri: okuryazarlikCell || null,
            zenginlestirme: zenginCell || null,
            okul_temelli_planlama: okulTemelliCell || null,
            _parseOrder: rowParseSeq++,
          };
          rows.push(newRow);
          if (newRow.unite) lastUnite = newRow.unite;
          if (newRow.konu) lastKonu = newRow.konu;
          if (newRow.kazanimlar) lastKazanim = newRow.kazanimlar;
          if (newRow.surec_bilesenleri) lastSurec = newRow.surec_bilesenleri;
          if (newRow.olcme_degerlendirme) lastOlcme = newRow.olcme_degerlendirme;
          if (newRow.sosyal_duygusal) lastSosyal = newRow.sosyal_duygusal;
          if (newRow.degerler) lastDegerler = newRow.degerler;
          if (newRow.okuryazarlik_becerileri) lastOkuryazarlik = newRow.okuryazarlik_becerileri;
          if (newRow.belirli_gun_haftalar) lastBelirliGun = newRow.belirli_gun_haftalar;
          if (newRow.zenginlestirme) lastZengin = newRow.zenginlestirme;
          if (newRow.okul_temelli_planlama) lastOkulTemelli = newRow.okul_temelli_planlama;
          continue;
        }

        // TYMM Excel'de hafta/tema hücreleri merge olabildiği için aynı haftanın
        // devam satırlarını son geçerli haftaya birleştir.
        const canMergeIntoPrevWeek =
          this.headersHaveAnyWeekColumn(mergedArr) ||
          this.isMergeContinuationRowNoHaftaColumn(
            rows,
            lastWeekOrder,
            rawUnite,
            rawKonu,
            rawKazanim,
            rawSurec,
            rawOlcme,
          );
        if (rows.length > 0 && lastWeekOrder >= 1 && lastWeekOrder <= 38 && canMergeIntoPrevWeek) {
          const lastIdx = rows.length - 1;
          const prev = rows[lastIdx];
          rows[lastIdx] = {
            ...prev,
            unite: this.appendCell(prev.unite, uniteCell),
            konu: this.appendCell(prev.konu, konuCell),
            kazanimlar: this.appendCell(prev.kazanimlar, kazanimCell),
            surec_bilesenleri: this.appendCell(prev.surec_bilesenleri, surecCell),
            olcme_degerlendirme: this.appendCell(prev.olcme_degerlendirme, olcmeCell),
            sosyal_duygusal: this.appendCell(prev.sosyal_duygusal, sosyalCell),
            degerler: this.appendCell(prev.degerler, degerlerCell),
            okuryazarlik_becerileri: this.appendCell(prev.okuryazarlik_becerileri, okuryazarlikCell),
            belirli_gun_haftalar: this.appendCell(prev.belirli_gun_haftalar, belirliGunCell),
            zenginlestirme: this.appendCell(prev.zenginlestirme, zenginCell),
            okul_temelli_planlama: this.appendCell(prev.okul_temelli_planlama, okulTemelliCell),
          };
          const r = rows[lastIdx];
          if (r.unite) lastUnite = r.unite;
          if (r.konu) lastKonu = r.konu;
          if (r.kazanimlar) lastKazanim = r.kazanimlar;
          if (r.surec_bilesenleri) lastSurec = r.surec_bilesenleri;
          if (r.olcme_degerlendirme) lastOlcme = r.olcme_degerlendirme;
          if (r.sosyal_duygusal) lastSosyal = r.sosyal_duygusal;
          if (r.degerler) lastDegerler = r.degerler;
          if (r.okuryazarlik_becerileri) lastOkuryazarlik = r.okuryazarlik_becerileri;
          if (r.belirli_gun_haftalar) lastBelirliGun = r.belirli_gun_haftalar;
          if (r.zenginlestirme) lastZengin = r.zenginlestirme;
          if (r.okul_temelli_planlama) lastOkulTemelli = r.okul_temelli_planlama;
          continue;
        }
        continue;
      }
      lastWeekOrder = Math.max(lastWeekOrder, weekOrder);

      const rowForDersSaati =
        weekOrder === 1 && rows.length === 0 && i > dataStartIndex
          ? (json[dataStartIndex] as unknown as Record<number, string | number>)
          : row;
      const parsedDersSaati = this.getNum(rowForDersSaati, colMap, 'ders_saati');
      const normalizedDersSaati =
        parsedDersSaati != null
          ? parsedDersSaati
          : this.resolveMissingDersSaati(uniteCell, konuCell, kazanimCell, defaultDersSaati);

      const newRow: ParsedPlanRow & { _parseOrder: number } = {
        week_order: Math.round(Number(weekOrder)),
        unite: uniteCell || null,
        konu: konuCell || null,
        kazanimlar: kazanimCell || null,
        ders_saati: normalizedDersSaati,
        belirli_gun_haftalar: belirliGunCell || null,
        surec_bilesenleri: surecCell || null,
        olcme_degerlendirme: olcmeCell || null,
        sosyal_duygusal: sosyalCell || null,
        degerler: degerlerCell || null,
        okuryazarlik_becerileri: okuryazarlikCell || null,
        zenginlestirme: zenginCell || null,
        okul_temelli_planlama: okulTemelliCell || null,
        _parseOrder: rowParseSeq++,
      };
      rows.push(newRow);
      if (newRow.unite) lastUnite = newRow.unite;
      if (newRow.konu) lastKonu = newRow.konu;
      if (newRow.kazanimlar) lastKazanim = newRow.kazanimlar;
      if (newRow.surec_bilesenleri) lastSurec = newRow.surec_bilesenleri;
      if (newRow.olcme_degerlendirme) lastOlcme = newRow.olcme_degerlendirme;
      if (newRow.sosyal_duygusal) lastSosyal = newRow.sosyal_duygusal;
      if (newRow.degerler) lastDegerler = newRow.degerler;
      if (newRow.okuryazarlik_becerileri) lastOkuryazarlik = newRow.okuryazarlik_becerileri;
      if (newRow.belirli_gun_haftalar) lastBelirliGun = newRow.belirli_gun_haftalar;
      if (newRow.zenginlestirme) lastZengin = newRow.zenginlestirme;
      if (newRow.okul_temelli_planlama) lastOkulTemelli = newRow.okul_temelli_planlama;
    }
    const sortedRows = [...rows].sort((a, b) => {
      const w = a.week_order - b.week_order;
      if (w !== 0) return w;
      return a._parseOrder - b._parseOrder;
    });
    const rowsPlain = sortedRows.map(({ _parseOrder, ...r }) => r);
    return {
      items: rowsPlain.map((r) =>
        this.sanitizeParsedPlanRowTextFields(
          this.redistributeMisplacedPlanFields(
            this.mergeKazanimSubitemsMisplacedInOlcme(
              this.mergeKazanimSubitemsMisplacedInSurec(this.redistributeMisplacedPlanFields(r)),
            ),
          ),
        ),
      ),
      planNotu: null,
    };
  }

  private appendCell(base?: string | null, extra?: string | null): string | null {
    const b = (base ?? '').trim();
    const e = (extra ?? '').trim();
    if (!e || e === '—') return b || null;
    if (!b || b === '—') return e;
    const bLower = b.toLowerCase();
    const eLower = e.toLowerCase();
    if (bLower === eLower || bLower.includes(eLower)) return b;
    return `${b}\n${e}`;
  }

  private resolveMissingDersSaati(
    unite: string,
    konu: string,
    kazanim: string,
    defaultDersSaati: number,
  ): number {
    const u = unite.trim();
    const k = konu.trim();
    const z = kazanim.trim();
    const blob = `${u} ${k} ${z}`.toLowerCase();
    const isPlaceholder = !u || u === '—' || !k || k === '—';
    const isSpecial =
      blob.includes('okul temelli planlama') ||
      blob.includes('sosyal etkinlik') ||
      blob.includes('ara tatil') ||
      blob.includes('yarıyıl tatili') ||
      blob.includes('yariyil tatili') ||
      blob.includes('resmî tatil') ||
      blob.includes('resmi tatil');
    if (isPlaceholder || isSpecial) return 2;
    return defaultDersSaati;
  }

  /** Hücre içi yorum / dipnot satırlarını ayır (Excel’de metin olarak yazılmış açıklamalar). */
  private stripYorumSatirlari(text: string | null): string | null {
    if (text == null || !String(text).trim()) return null;
    const lines = String(text).split(/\r?\n/);
    const kept: string[] = [];
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      if (this.looksLikeInstructionLine(line)) continue;
      kept.push(line);
    }
    const out = kept.join('\n').trim();
    return out || null;
  }

  private looksLikeInstructionLine(line: string): boolean {
    const t = line.replace(/\s+/g, ' ').trim();
    if (!t) return false;
    if (t.length >= 15 && this.looksLikeFootnote(t, 15)) return true;
    if (/^\s*[\*•]\s/.test(t) && t.length > 30) {
      const low = t.toLowerCase();
      if (
        /zümre|zumre|kurul|müdür|mudur|kapsamaktadır|dipnot|açıklama\s*:|aciklama\s*:|öğretmenler kurulu|ogretmenler kurulu|kararı|karari/i.test(
          low,
        )
      )
        return true;
    }
    if (/^\s*(not|açıklama|aciklama|örnek|ornek|dikkat|uyarı|uyari)\s*:?\s*/i.test(t)) return true;
    return false;
  }

  private sanitizeParsedPlanRowTextFields(row: ParsedPlanRow): ParsedPlanRow {
    const fields: (keyof ParsedPlanRow)[] = [
      'unite',
      'konu',
      'kazanimlar',
      'belirli_gun_haftalar',
      'surec_bilesenleri',
      'olcme_degerlendirme',
      'sosyal_duygusal',
      'degerler',
      'okuryazarlik_becerileri',
      'zenginlestirme',
      'okul_temelli_planlama',
    ];
    const out: ParsedPlanRow = { ...row };
    for (const f of fields) {
      const v = out[f];
      if (typeof v === 'string') {
        const s = this.stripYorumSatirlari(v);
        (out as unknown as Record<string, string | number | null | undefined>)[f] = s ?? null;
      }
    }
    return out;
  }

  private looksLikeFootnote(text: string, minLen = 20): boolean {
    const t = text.replace(/\s+/g, ' ').trim();
    if (!t || t.length < minLen) return false;
    const keywords = [
      'okul temelli planlama',
      'zümre öğretmenler kurulu',
      'zümre öğretmen kurulu',
      'kapsamaktadır',
      'sosyal etkinlik',
      'yerel çalışmalar',
      'proje çalışmaları',
    ];
    return (
      t.startsWith('*') ||
      keywords.some((kw) => t.includes(kw)) ||
      (t.includes('kurulu') && t.includes('kararı'))
    );
  }

  private looksLikeHeaderRow(row: Record<number, string | number>): boolean {
    const cells = Array.isArray(row) ? row : Object.values(row);
    const sample = cells.slice(0, 18).map((c) => String(c ?? '').trim().toLowerCase());
    if (sample.some((c) => /^\d+$/.test(c) && parseInt(c, 10) >= 1 && parseInt(c, 10) <= 38))
      return false;
    const concat = sample.join(' ');
    const headerKeywords = [
      'hafta',
      'ünite',
      'unite',
      'konu',
      'kazanım',
      'öğrenme',
      'saat',
      'ölçme',
      'süreç',
      'sosyal',
      'okuryaz',
      'week',
      'theme',
      'functions',
      'learning',
      'outcomes',
      'date',
    ];
    return headerKeywords.filter((kw) => concat.includes(kw)).length >= 2;
  }

  private normalizeHeaderCellForWeek(raw: string): string {
    return String(raw ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  /** Başlık satırında gerçekten "hafta" / week numarası sütunu var mı (örtük sıra modu için). */
  private headersHaveAnyWeekColumn(mergedHeaderArr: string[]): boolean {
    for (let i = 0; i < Math.min(mergedHeaderArr.length, 40); i++) {
      const h = this.normalizeHeaderCellForWeek(String(mergedHeaderArr[i] ?? ''));
      if (h && this.headerCellLooksLikeWeekHeader(h)) return true;
    }
    return false;
  }

  private headerCellLooksLikeWeekHeader(normalized: string): boolean {
    const a = normalized
      .replace(/ı/g, 'i')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c');
    if (/\bhafta\b/.test(a)) return true;
    if (/^weeks?$/.test(a.trim())) return true;
    if (/hafta\s*no|sira\s*no|sıra\s*no|week\s*no/.test(a)) return true;
    return false;
  }

  /** Bu sütundan hafta numarası olarak ilk rakam çekilmez (ünite no, ders saati, konu sırası vb.). */
  private headerCellLooksLikeContentField(normalized: string): boolean {
    if (!normalized.trim()) return false;
    const a = normalized
      .replace(/ı/g, 'i')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c');
    return /unite|tema|konu|kazanim|ogrenme|surec|olcme|sosyal|deger|okuryaz|belirli|zengin|okul\s*temel|ders\s*saat|icerik|cerceve|outcome|learning|assessment|material|theme|function/i.test(
      a,
    );
  }

  /** Hafta sütunu yok; ünite/konu hücresi boş devam satırı — önceki haftaya birleştir. */
  private isMergeContinuationRowNoHaftaColumn(
    rows: ParsedPlanRow[],
    lastWeekOrder: number,
    rawUnite: string,
    rawKonu: string,
    rawKazanim: string,
    rawSurec: string,
    rawOlcme: string,
  ): boolean {
    if (rows.length === 0 || lastWeekOrder < 1) return false;
    if (rawUnite.trim() || rawKonu.trim()) return false;
    return !!(
      rawKazanim.trim() ||
      rawSurec.trim() ||
      rawOlcme.trim()
    );
  }

  private extractWeekOrder(
    row: Record<number, string | number>,
    colMap: Record<string, number>,
    mergedHeaderArr: string[],
  ): number | null {
    const forbiddenCols = new Set<number>();
    for (const [field, idx] of Object.entries(colMap)) {
      if (field === 'week_order') continue;
      if (typeof idx === 'number' && idx >= 0) forbiddenCols.add(idx);
    }

    const parseWeekFromCell = (colIdx: number): number | null => {
      if (colIdx < 0 || colIdx > 40) return null;
      const hRaw = String(mergedHeaderArr[colIdx] ?? '').trim();
      const hn = hRaw ? this.normalizeHeaderCellForWeek(hRaw) : '';
      if (hn && this.headerCellLooksLikeContentField(hn) && !this.headerCellLooksLikeWeekHeader(hn)) return null;

      const cell = row[colIdx];
      if (cell == null || cell === '') return null;
      const s = String(cell).trim();
      const m = s.match(/^(\d+)/);
      if (m && !this.cellLeadingNumberIsFakeWeek(s)) {
        const n = parseInt(m[1], 10);
        if (n >= 1 && n <= 38) return n;
      }
      const inline = this.extractInlineWeekOrder(s);
      if (inline != null) return inline;
      const num = Number(cell);
      if (Number.isFinite(num) && num >= 1 && num <= 38) return Math.round(num);
      return null;
    };

    const wi = colMap.week_order;
    if (wi != null && wi >= 0) {
      const hRaw = String(mergedHeaderArr[wi] ?? '').trim();
      const hn = hRaw ? this.normalizeHeaderCellForWeek(hRaw) : '';
      const weekHeaderTrusted = !hn || this.headerCellLooksLikeWeekHeader(hn);
      if (weekHeaderTrusted) {
        let v = this.getNum(row, colMap, 'week_order');
        if (v != null && v >= 1 && v <= 38) return v;
        const cell = row[wi];
        if (cell != null) {
          const s = String(cell).trim();
          const m = s.match(/^(\d+)/);
          if (m && !this.cellLeadingNumberIsFakeWeek(s)) {
            const n = parseInt(m[1], 10);
            if (n >= 1 && n <= 38) return n;
          }
          const inline = this.extractInlineWeekOrder(s);
          if (inline != null) return inline;
        }
      }
    }

    for (let col = 0; col < 10; col++) {
      if (forbiddenCols.has(col)) continue;
      const parsed = parseWeekFromCell(col);
      if (parsed != null) return parsed;
    }
    return null;
  }

  private buildColumnMap(headerRow: Record<number, string> | unknown[]): Record<string, number> {
    const map: Record<string, number> = {};
    const arr = Array.isArray(headerRow) ? headerRow : Object.entries(headerRow).map(([, v]) => v);
    const normalize = (s: string) =>
      String(s ?? '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    const toAscii = (s: string) =>
      s.replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c');
    const maxIdx = Math.min(40, Math.max(arr.length, 16));
    let emptyStreak = 0;
    for (let idx = 0; idx < maxIdx; idx++) {
      const raw = String((arr as unknown[])[idx] ?? '');
      const val = normalize(raw);
      if (!val) {
        emptyStreak++;
        if (emptyStreak >= 10) break;
        continue;
      }
      emptyStreak = 0;
      for (const [field, aliases] of Object.entries(COL_ALIASES)) {
        if (map[field] != null) continue;
        const normAliases = aliases
          .map((a) => toAscii(a.toLowerCase()))
          .sort((a, b) => b.length - a.length);
        const normVal = toAscii(val);
        if (
          normAliases.some((a) => {
            if (!a || !normVal) return false;
            if (normVal.includes(a)) return true;
            // 'ay' gibi kısa başlıkların 'hafta' içinde yanlış eşleşmesini engelle
            if (normVal.length >= 4 && a.includes(normVal)) return true;
            return false;
          })
        ) {
          map[field] = idx;
          break;
        }
      }
    }
    const requiredFields = ['unite', 'konu', 'kazanimlar'];
    if (requiredFields.some((f) => map[f] == null) && arr.length >= 5) {
      const first = normalize(String(arr[0] ?? ''));
      const second = normalize(String(arr[1] ?? ''));
      const third = normalize(String(arr[2] ?? ''));
      const fourth = normalize(String(arr[3] ?? ''));
      const fifth = normalize(String(arr[4] ?? ''));
      const fourthAsc = toAscii(fourth);
      const isModulSablonu =
        arr.length >= 10 &&
        first.includes('ders') &&
        first.includes('saat') &&
        (toAscii(second).includes('unite') || second.includes('tema') || second.includes('ünite')) &&
        (toAscii(third).includes('konu') || third.includes('içerik') || third.includes('icerik')) &&
        fourthAsc.includes('ogrenme') &&
        (fourthAsc.includes('cikt') || fourth.includes('çıkt')) &&
        (fifth.includes('belirli') || (fifth.includes('gun') && fifth.includes('hafta')));
      const joined = arr
        .slice(0, 8)
        .map((v) => normalize(String(v ?? '')))
        .join(' ');
      const isEnglishTemplate =
        joined.includes('week') ||
        joined.includes('theme') ||
        joined.includes('functions') ||
        joined.includes('learning outcomes') ||
        second.includes('date') ||
        second.includes('dates');
      const hasDateColumn =
        second.includes('date') ||
        second.includes('dates') ||
        second.includes('tarih') ||
        /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/.test(second);
      const hasAyColumn =
        first === 'ay' ||
        first === 'sure' ||
        first.includes('eylul') ||
        first.includes('ekim') ||
        first.includes('kasim') ||
        first.includes('aralik') ||
        first.includes('ocak') ||
        first.includes('subat') ||
        first.includes('mart') ||
        first.includes('nisan') ||
        first.includes('mayis') ||
        first.includes('haziran') ||
        second.includes('hafta') ||
        hasDateColumn;
      // TYMM/Maarif: AY + HAFTA + DERS SAATİ + … (ikinci sütun "Hafta No" vb. olabilir; hasAyColumn ile eski yanlış haritaya düşmesin)
      const isTarihTemplate =
        first === 'sure' ||
        (first === 'ay' && second.includes('hafta') && (third.includes('saat') || third.includes('ders'))) ||
        (first === 'ay' && second.includes('hafta') && toAscii(fourth).includes('unite') && toAscii(fifth).includes('konu'));
      const fallback: Record<string, number> = isEnglishTemplate
        ? {
            week_order: 0,
            ders_saati: 2,
            unite: 3,
            konu: 4,
            kazanimlar: 5,
            surec_bilesenleri: 6,
            belirli_gun_haftalar: 7,
            degerler: 8,
            okuryazarlik_becerileri: 9,
            olcme_degerlendirme: 10,
            zenginlestirme: 11,
            okul_temelli_planlama: 12,
          }
        : isTarihTemplate
          ? {
              // Yeni Tarih/Maarif şablonu (SÜRE/AY, HAFTA, DERS SAATİ, ÜNİTE/TEMA, KONU, ÖĞRENME ÇIKTILARI, SÜREÇ BİLEŞENLERİ, ÖLÇME, SOSYAL, DEĞERLER, OKURYAZARLIK, BELİRLİ GÜN, FARKLILAŞTIRMA, OKUL TEMELLİ)
              week_order: 1,
              ders_saati: 2,
              unite: 3,
              konu: 4,
              kazanimlar: 5,
              surec_bilesenleri: 6,
              olcme_degerlendirme: 7,
              sosyal_duygusal: 8,
              degerler: 9,
              okuryazarlik_becerileri: 10,
              belirli_gun_haftalar: 11,
              zenginlestirme: 12,
              okul_temelli_planlama: 13,
            }
          : isModulSablonu
            ? {
                // Modül şablonu: Ders saati, Ünite/TEMA, Konu, Öğrenme çıktıları, Belirli gün, Farklılaştırma, Okul temelli, Ölçme, Değerler, Okuryazarlık
                week_order: -1,
                ders_saati: 0,
                unite: 1,
                konu: 2,
                kazanimlar: 3,
                belirli_gun_haftalar: 4,
                zenginlestirme: 5,
                okul_temelli_planlama: 6,
                olcme_degerlendirme: 7,
                degerler: 8,
                okuryazarlik_becerileri: 9,
              }
            : hasAyColumn
          ? {
              // Klasik AY(0), HAFTA(1), DERS SAAT(2), ÜNİTE(3), SOSYAL(4), DEĞERLER(5), OKURYAZARLIK(6),
              // BELİRLİ GÜN(7), KONU(8), OKUL TEMELLİ(9), ÖĞRENME ÇIKTILARI(10), SÜREÇ(11), ÖLÇME(12)
              week_order: 1,
              ders_saati: 2,
              unite: 3,
              sosyal_duygusal: 4,
              degerler: 5,
              okuryazarlik_becerileri: 6,
              belirli_gun_haftalar: 7,
              konu: 8,
              okul_temelli_planlama: 9,
              kazanimlar: 10,
              surec_bilesenleri: 11,
              olcme_degerlendirme: 12,
            }
          : {
              // A Hafta, B Ders saati, C Ünite/TEMA, D Konu, E ara/boş, F Öğrenme çıktıları (F4’ten veri)
              week_order: 0,
              ders_saati: 1,
              unite: 2,
              konu: 3,
              kazanimlar: 5,
              surec_bilesenleri: 6,
              olcme_degerlendirme: 7,
              sosyal_duygusal: 8,
              degerler: 9,
              okuryazarlik_becerileri: 10,
              belirli_gun_haftalar: 11,
              zenginlestirme: 12,
              okul_temelli_planlama: 13,
            };
      for (const [f, i] of Object.entries(fallback)) {
        if (map[f] == null && i < arr.length) map[f] = i;
      }
    }
    // F sütununda Öğrenme çıktıları varsa kazanım F (5); D’de öğrenme varsa (modül şablonu) ezme.
    const h3 = normalize(String(arr[3] ?? ''));
    const h3Asc = toAscii(h3);
    const h3IsOgrenmeCikti =
      h3.length >= 4 &&
      h3Asc.includes('ogrenme') &&
      (h3Asc.includes('cikt') || h3.includes('çıkt') || h3Asc.includes('cikti'));
    const hF = normalize(String(arr[5] ?? ''));
    const hFAsc = toAscii(hF);
    if (
      !h3IsOgrenmeCikti &&
      hF.length >= 4 &&
      hFAsc.includes('ogrenme') &&
      (hFAsc.includes('cikt') || hF.includes('çıkt') || hFAsc.includes('cikti'))
    ) {
      map.kazanimlar = 5;
    }
    if (map.week_order == null) {
      map.week_order = -1;
    }
    return map;
  }

  private getStr(
    row: Record<number, string | number>,
    colMap: Record<string, number>,
    field: string,
  ): string | null {
    const idx = colMap[field];
    if (idx == null || idx < 0) return null;
    const v = row[idx];
    if (v == null) return null;
    const s = String(v).trim();
    return s || null;
  }

  private getNum(
    row: Record<number, string | number>,
    colMap: Record<string, number>,
    field: string,
  ): number | null {
    const idx = colMap[field];
    if (idx == null || idx < 0) return null;
    const v = row[idx];
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  getSubjectLabel(subjectCode: string): string {
    const lower = (subjectCode ?? '').toLowerCase().trim();
    if (lower in SUBJECT_LABELS) return SUBJECT_LABELS[lower];
    const base = lower.replace(/_maarif.*$/, '');
    return SUBJECT_LABELS[base] ?? subjectCode;
  }

  /** Mevcut TYMM taslak planı olan dersler. grade verilirse sınıfa uygun dersler döner (Temel 1-8, Ortaöğretim 9-12). */
  getAvailableSubjects(grade?: number): string[] {
    if (grade != null && grade >= 1 && grade <= 12) {
      return getTymmAvailableSubjectCodes(grade);
    }
    return getTymmAvailableSubjectCodes();
  }
}
