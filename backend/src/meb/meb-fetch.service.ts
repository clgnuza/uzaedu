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

/** Sütun adı eşlemesi – farklı Excel formatlarına uyum (TYMM, Temel Eğitim varyantları) */
const COL_ALIASES: Record<string, string[]> = {
  week_order: ['hafta', 'hafteno', 'hafta no', 'hafta no.', 'no', 'sıra', 'sira', 'sıra no', 'week', 'weeks'],
  unite: [
    'ünite', 'unite', 'ünite/tema', 'ünite / tema', 'ünite tema', 'tema', 'tema/ünite', 'unit',
    'ünite ve tema', 'unite ve tema', 'theme', 'unit/theme', 'theme/unit',
  ],
  konu: [
    'konu', 'işlenen konu', 'islenen konu', 'içerik çerçevesi', 'icerik cercevesi',
    'içerik', 'icerik', 'konu içeriği', 'işlenecek konu',
    'functions', 'language functions', 'communicative functions', 'topics', 'content',
  ],
  kazanimlar: [
    'kazanımlar', 'kazanimlar', 'öğrenme çıktıları', 'ogrenme ciktilari', 'kazanim', 'öğrenme çıktısı',
    'öğrenme çıktısı', 'ogrenme ciktisi', 'kazanım', 'öğrenme',
    'learning outcomes', 'learning outcome', 'outcomes', 'students will be able',
  ],
  ders_saati: ['ders saati', 'derssaati', 'saat', 'toplam saat', 'hour', 'hours'],
  belirli_gun_haftalar: [
    'belirli gün ve haftalar', 'belirli gun', 'belirli gun ve haftalar',
    'belirli gün', 'özel gün', 'belirli gün ve h.', 'b.g. ve h.', 'bel. gün',
    'special days', 'special days and weeks',
  ],
  surec_bilesenleri: [
    'süreç bileşenleri', 'surec bilesenleri', 'süreç bileşen', 'süreç', 'programlar arası',
    'tymm süreç', 'surec',
    'language skills', 'skills',
  ],
  olcme_degerlendirme: [
    'ölçme ve değerlendirme', 'olcme degerlendirme', 'ölçme değerlendirme',
    'ölçme', 'olcme', 'değerlendirme', 'degerlendirme',
    'materials', 'tools and materials', 'assessment',
  ],
  sosyal_duygusal: [
    'sosyal duygusal', 'sosyal-duygusal', 'sosyal duygusal öğrenme',
    'sosyal ve duygusal', 'sosyal-duygusal öğrenme',
    'sos.-duyg.', 'sos. duyg.', 'sos duyg', 'sosyal-duyg',
  ],
  degerler: ['değerler', 'degerler', 'değer'],
  okuryazarlik_becerileri: [
    'okuryazarlık', 'okuryazarlik', 'okur yazarlık', 'okuryazarlık becerileri',
    'okur yazarlik',
  ],
  zenginlestirme: ['zenginleştirme', 'zenginlestirme', 'zenginleştirme etkinlikleri', 'farklılaştırma', 'farklilastirma', 'farklılaştırma etkinlikleri'],
  okul_temelli_planlama: [
    'okul temelli', 'okul temelli planlama', 'okul temelli planlama ve uygulama',
    'okul temelli planlama ve uygulamalar', 'in-class adaptations', 'adaptations',
  ],
};

@Injectable()
export class MebFetchService {
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
      headers: { 'User-Agent': 'OgretmenPro/1.0 (MEB müfredat senkronizasyonu)' },
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
  ): { items: ParsedPlanRow[]; planNotu: string | null } {
    return this.parseExcelPlanInternal(filePath, grade, subjectCode);
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

  /** TYMM/SBL Excel'de başlık satırları olabilir; ilk 5 satırda header satırını bul. HAFTA sütunu olan satır önceliklidir. */
  private findHeaderRowIndex(json: unknown[][]): number {
    const headerKeywords = ['hafta', 'ünite', 'unite', 'konu', 'kazanım', 'kazanim', 'öğrenme', 'ogrenme'];
    const normalize = (s: string) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
    let bestIdx = 0;
    let bestScore = 0;
    for (let rowIdx = 0; rowIdx < Math.min(5, json.length); rowIdx++) {
      const row = json[rowIdx];
      if (!row) continue;
      const cells = Array.isArray(row) ? row : Object.values(row);
      const concat = cells.map((c) => normalize(String(c ?? ''))).join(' ');
      const matchCount = headerKeywords.filter((kw) => concat.includes(kw)).length;
      if (matchCount >= 2) {
        const hasHafta = concat.includes('hafta');
        const score = matchCount * 2 + (hasHafta ? 10 : 0);
        if (score > bestScore) {
          bestScore = score;
          bestIdx = rowIdx;
        }
      }
    }
    return bestIdx;
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
  ): { items: ParsedPlanRow[]; planNotu: string | null } {
    const wb = XLSX.readFile(filePath, { cellDates: false });
    const sheetNamesByGrade =
      grade != null
        ? this.getSheetNamesForGrade(wb, grade)
        : [wb.SheetNames?.[0]].filter(Boolean) as string[];
    const sheetNames = this.filterNamesByProgram(sheetNamesByGrade, subjectCode);
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

    return { items: bestRows.sort((a, b) => a.week_order - b.week_order), planNotu: bestPlanNotu };
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
    // Gruplandırılmış başlık: alt satır boş hücrelerde üst satırdaki sütun adını kullan (örn. FARKLILAŞTIRMA)
    const mainRow = json[headerRowIndex] as Record<number, string>;
    const rowAbove = headerRowIndex > 0 ? (json[headerRowIndex - 1] as Record<number, string>) : null;
    const mergedArr: string[] = [];
    for (let idx = 0; idx < 24; idx++) {
      const main = String(mainRow?.[idx] ?? '').trim();
      const above = rowAbove ? String(rowAbove[idx] ?? '').trim() : '';
      mergedArr[idx] = main || above;
    }
    let colMap = this.buildColumnMap(mergedArr);
    const dataStartIndex = headerRowIndex + 1;
    const rows: ParsedPlanRow[] = [];
    const footnoteParts: string[] = [];
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

    for (let i = dataStartIndex; i < json.length; i++) {
      const row = json[i] as unknown as Record<number, string | number>;

      if (this.looksLikeHeaderRow(row)) {
        const newColMap = this.buildColumnMap(row as unknown as Record<number, string>);
        if (Object.keys(newColMap).length >= 2) colMap = newColMap;
        continue;
      }

      let weekOrder = this.extractWeekOrder(row, colMap);
      const rawKonu = this.getStr(row, colMap, 'konu') || '';
      const rawUnite = this.getStr(row, colMap, 'unite') || '';
      const rawKazanim = this.getStr(row, colMap, 'kazanimlar') || '';
      const rawSurec = this.getStr(row, colMap, 'surec_bilesenleri') || '';
      const rawOlcme = this.getStr(row, colMap, 'olcme_degerlendirme') || '';
      const rawSosyal = this.getStr(row, colMap, 'sosyal_duygusal') || '';
      const rawDegerler = this.getStr(row, colMap, 'degerler') || '';
      const rawOkuryazarlik = this.getStr(row, colMap, 'okuryazarlik_becerileri') || '';
      const rawBelirliGun = this.getStr(row, colMap, 'belirli_gun_haftalar') || '';
      const rawZengin = this.getStr(row, colMap, 'zenginlestirme') || '';
      const rawOkulTemelli = this.getStr(row, colMap, 'okul_temelli_planlama') || '';
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
      const zenginCell = rawZengin || lastZengin;
      const okulTemelliCell = rawOkulTemelli || lastOkulTemelli;
      const fullText = `${uniteCell} ${konuCell} ${kazanimCell}`.toLowerCase();

      // Tablo altı dipnot: yıldızlı açıklama, okul temelli vb. – konu'ya koyma
      if (
        (weekOrder == null || weekOrder < 1 || weekOrder > 38) &&
        this.looksLikeFootnote(fullText)
      ) {
        const part = [uniteCell, konuCell, kazanimCell].filter(Boolean).join(' ').trim();
        if (part) footnoteParts.push(part);
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
          const newRow = {
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
        if (rows.length > 0 && lastWeekOrder >= 1 && lastWeekOrder <= 38) {
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

      const parsedDersSaati = this.getNum(row, colMap, 'ders_saati');
      const normalizedDersSaati =
        parsedDersSaati != null
          ? parsedDersSaati
          : this.resolveMissingDersSaati(uniteCell, konuCell, kazanimCell, defaultDersSaati);

      const newRow = {
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
    const planNotu = footnoteParts.length > 0 ? footnoteParts.join(' ') : null;
    return { items: rows, planNotu };
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

  private looksLikeFootnote(text: string): boolean {
    const t = text.replace(/\s+/g, ' ').trim();
    if (!t || t.length < 20) return false;
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
    const firstCells = cells.slice(0, 6).map((c) => String(c ?? '').trim().toLowerCase());
    if (firstCells.some((c) => /^\d+$/.test(c) && parseInt(c, 10) >= 1 && parseInt(c, 10) <= 38))
      return false;
    const concat = firstCells.join(' ');
    const headerKeywords = ['hafta', 'ünite', 'unite', 'konu', 'kazanım', 'öğrenme', 'week', 'theme', 'functions', 'learning', 'outcomes', 'date'];
    return headerKeywords.filter((kw) => concat.includes(kw)).length >= 2;
  }

  private extractWeekOrder(
    row: Record<number, string | number>,
    colMap: Record<string, number>,
  ): number | null {
    let v = this.getNum(row, colMap, 'week_order');
    if (v != null && v >= 1 && v <= 38) return v;

    const idx = colMap.week_order;
    if (idx != null) {
      const cell = row[idx];
      if (cell != null) {
        const s = String(cell).trim();
        const m = s.match(/^(\d+)/);
        if (m) {
          const n = parseInt(m[1], 10);
          if (n >= 1 && n <= 38) return n;
        }
        const inline = this.extractInlineWeekOrder(s);
        if (inline != null) return inline;
      }
    }

    for (let col = 0; col < 10; col++) {
      const cell = row[col];
      if (cell == null) continue;
      const s = String(cell).trim();
      const m = s.match(/^(\d+)/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n >= 1 && n <= 38) return n;
      }
      const inline = this.extractInlineWeekOrder(s);
      if (inline != null) return inline;
      const num = Number(cell);
      if (Number.isFinite(num) && num >= 1 && num <= 38) return Math.round(num);
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
    for (let idx = 0; idx < Math.max(arr.length, 16); idx++) {
      const raw = String((arr as unknown[])[idx] ?? '');
      const val = normalize(raw);
      if (!val && idx >= 14) break;
      for (const [field, aliases] of Object.entries(COL_ALIASES)) {
        const normAliases = aliases.map((a) => toAscii(a.toLowerCase()));
        const normVal = toAscii(val);
        if (normAliases.some((a) => normVal.includes(a) || a.includes(normVal))) {
          map[field] = idx;
          break;
        }
      }
    }
    if (map.week_order == null) {
      map.week_order = 0;
    }
    const requiredFields = ['unite', 'konu', 'kazanimlar'];
    if (requiredFields.some((f) => map[f] == null) && arr.length >= 5) {
      const first = normalize(String(arr[0] ?? ''));
      const second = normalize(String(arr[1] ?? ''));
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
        : {
            week_order: hasAyColumn ? 1 : 0,
            unite: hasAyColumn ? 2 : 1,
            ders_saati: hasAyColumn ? 3 : 2,
            konu: hasAyColumn ? 4 : 3,
            kazanimlar: hasAyColumn ? 5 : 4,
            surec_bilesenleri: hasAyColumn ? 6 : 5,
            olcme_degerlendirme: hasAyColumn ? 7 : 6,
            sosyal_duygusal: hasAyColumn ? 8 : 7,
            degerler: hasAyColumn ? 9 : 8,
            okuryazarlik_becerileri: hasAyColumn ? 10 : 9,
            belirli_gun_haftalar: hasAyColumn ? 11 : 10,
            zenginlestirme: hasAyColumn ? 12 : 11,
            okul_temelli_planlama: hasAyColumn ? 13 : 12,
          };
      for (const [f, i] of Object.entries(fallback)) {
        if (map[f] == null && i < arr.length) map[f] = i;
      }
    }
    return map;
  }

  private getStr(
    row: Record<number, string | number>,
    colMap: Record<string, number>,
    field: string,
  ): string | null {
    const idx = colMap[field];
    if (idx == null) return null;
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
    if (idx == null) return null;
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
