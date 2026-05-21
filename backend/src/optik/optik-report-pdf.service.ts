import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PDFDocument, PDFFont, PDFPage, rgb } from 'pdf-lib';
import { Repository } from 'typeorm';
import { School } from '../schools/entities/school.entity';
import { User } from '../users/entities/user.entity';
import {
  OptikSessionPdfType,
  OutcomeInsightsForPdf,
  PeriodReportForPdf,
  SessionReportForPdf,
} from './optik-report-pdf.types';
import {
  loadSchoolAdminsForOptikPdf,
  resolveOptikPdfBranding,
} from './optik-pdf-belge.util';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fontkitRaw = require('@pdf-lib/fontkit');
const fontkit = fontkitRaw?.default ?? fontkitRaw;

function getDejaVuFontPaths(): { sans: string; bold: string } {
  try {
    const sans = require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans.ttf');
    const bold = require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf');
    return { sans, bold };
  } catch {
    const base = join(process.cwd(), 'node_modules', 'dejavu-fonts-ttf', 'ttf');
    return { sans: join(base, 'DejaVuSans.ttf'), bold: join(base, 'DejaVuSans-Bold.ttf') };
  }
}

const PRIMARY = rgb(0.12, 0.22, 0.48);
const MUTED = rgb(0.45, 0.48, 0.55);
const HEADER_BG = rgb(0.94, 0.95, 0.98);
const ROW_ALT = rgb(0.98, 0.99, 1);
const BORDER = rgb(0.82, 0.85, 0.92);

function slugFilename(s: string): string {
  const t = s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return t || 'rapor';
}

function pushCharWrapped(line: string, font: PDFFont, size: number, maxW: number, maxLines: number, out: string[]): void {
  let chunk = '';
  for (const ch of line) {
    const next = chunk + ch;
    if (font.widthOfTextAtSize(next, size) <= maxW) {
      chunk = next;
      continue;
    }
    if (chunk) {
      out.push(chunk);
      if (out.length >= maxLines) return;
    }
    chunk = font.widthOfTextAtSize(ch, size) <= maxW ? ch : '…';
  }
  if (chunk && out.length < maxLines) out.push(chunk);
}

function fitLines(text: string, font: PDFFont, size: number, maxW: number, maxLines: number): string[] {
  const raw = String(text ?? '—').trim() || '—';
  if (maxW < 8 || maxLines < 1) return ['—'];
  const words = raw.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) <= maxW) {
      cur = next;
      continue;
    }
    if (cur) {
      lines.push(cur);
      if (lines.length >= maxLines) return lines.slice(0, maxLines);
    }
    if (font.widthOfTextAtSize(w, size) <= maxW) {
      cur = w;
    } else {
      pushCharWrapped(w, font, size, maxW, maxLines, lines);
      cur = '';
      if (lines.length >= maxLines) return lines.slice(0, maxLines);
    }
  }
  if (cur && lines.length < maxLines) {
    if (font.widthOfTextAtSize(cur, size) <= maxW) lines.push(cur);
    else pushCharWrapped(cur, font, size, maxW, maxLines, lines);
  }
  if (!lines.length) pushCharWrapped(raw, font, size, maxW, maxLines, lines);
  return lines.slice(0, maxLines);
}

function normalizeKey(key: Record<string, string> | Record<number, string>, q: number): string {
  const rec = key as Record<string, string>;
  const k = rec[String(q)] ?? rec[q as unknown as string];
  return (k ?? '').toUpperCase();
}

function scaleColWidths(widths: number[], contentW: number): number[] {
  const sum = widths.reduce((a, b) => a + b, 0);
  if (sum <= contentW || sum <= 0) return widths;
  return widths.map((w) => Math.max(22, Math.floor((w / sum) * contentW)));
}

class PdfLayout {
  doc!: PDFDocument;
  font!: PDFFont;
  fontBold!: PDFFont;
  page!: PDFPage;
  y = 0;
  pageIndex = 0;
  readonly pageW = 595;
  readonly pageH = 842;
  readonly margin = 40;

  async init(): Promise<void> {
    this.doc = await PDFDocument.create();
    this.doc.registerFontkit(fontkit);
    const fp = getDejaVuFontPaths();
    this.font = await this.doc.embedFont(readFileSync(fp.sans));
    this.fontBold = await this.doc.embedFont(readFileSync(fp.bold));
    this.newPage();
  }

  private stampFooter(): void {
    const idx = this.doc.getPageCount();
    if (idx < 1) return;
    const p = this.doc.getPage(idx - 1);
    p.drawText(`Sayfa ${this.pageIndex}`, {
      x: this.pageW - this.margin - 55,
      y: 22,
      size: 7.5,
      font: this.font,
      color: MUTED,
    });
    p.drawText('ÖğretmenPro · Optik', {
      x: this.margin,
      y: 22,
      size: 7,
      font: this.font,
      color: MUTED,
    });
  }

  newPage(): void {
    if (this.pageIndex > 0) this.stampFooter();
    this.pageIndex += 1;
    this.page = this.doc.addPage([this.pageW, this.pageH]);
    this.y = this.pageH - this.margin;
  }

  ensure(h: number): void {
    if (this.y - h < this.margin + 28) this.newPage();
  }

  header(
    schoolName: string,
    title: string,
    meta: Array<{ label: string; value: string }>,
    academicYear: string,
  ): void {
    const contentW = this.pageW - this.margin * 2;
    const stripH = 22;
    this.page.drawRectangle({
      x: this.margin,
      y: this.y - stripH + 4,
      width: contentW,
      height: stripH,
      color: PRIMARY,
    });
    const yearLines = fitLines(academicYear, this.font, 7, contentW * 0.42, 2);
    const yearBlockW = Math.min(
      contentW * 0.44,
      Math.max(80, ...yearLines.map((l) => this.font.widthOfTextAtSize(l, 7))),
    );
    let yYear = this.y - 8;
    for (const ln of yearLines) {
      const lw = this.font.widthOfTextAtSize(ln, 7);
      this.page.drawText(ln, {
        x: this.pageW - this.margin - 6 - lw,
        y: yYear,
        size: 7,
        font: this.font,
        color: rgb(0.92, 0.94, 1),
      });
      yYear -= 8;
    }
    const nameMaxW = contentW - yearBlockW - 14;
    const nameLines = fitLines(schoolName, this.font, 9, nameMaxW, 2);
    let yName = this.y - 9;
    for (const ln of nameLines) {
      this.page.drawText(ln, {
        x: this.margin + 6,
        y: yName,
        size: 9,
        font: this.font,
        color: rgb(1, 1, 1),
      });
      yName -= 10;
    }
    this.y -= stripH + 6;

    const titleLines = fitLines(title, this.fontBold, 12, contentW, 2);
    for (const ln of titleLines) {
      this.page.drawText(ln, {
        x: this.margin,
        y: this.y,
        size: 12,
        font: this.fontBold,
        color: PRIMARY,
      });
      this.y -= 13;
    }
    this.y -= 4;
    this.page.drawLine({
      start: { x: this.margin, y: this.y },
      end: { x: this.pageW - this.margin, y: this.y },
      thickness: 1.1,
      color: PRIMARY,
    });
    this.y -= 12;

    const perRow = 3;
    const gap = 5;
    const colW = (contentW - gap * (perRow - 1)) / perRow;
    for (let ri = 0; ri < Math.ceil(meta.length / perRow); ri++) {
      const rowCols = meta.slice(ri * perRow, ri * perRow + perRow);
      let rowH = 0;
      const layouts = rowCols.map((col) => {
        const lines = fitLines(col.value, this.fontBold, 7, colW - 8, 3);
        const boxH = 16 + lines.length * 8.5;
        rowH = Math.max(rowH, boxH);
        return { col, lines, boxH };
      });
      for (let i = 0; i < layouts.length; i++) {
        const { col, lines, boxH } = layouts[i]!;
        const x = this.margin + i * (colW + gap);
        this.page.drawRectangle({
          x,
          y: this.y - boxH + 4,
          width: colW,
          height: boxH,
          color: rgb(0.96, 0.97, 1),
          borderColor: BORDER,
          borderWidth: 0.5,
        });
        this.page.drawText(col.label, {
          x: x + 4,
          y: this.y - 2,
          size: 6,
          font: this.font,
          color: MUTED,
        });
        let ly = this.y - 10;
        for (const line of lines) {
          this.page.drawText(line, {
            x: x + 4,
            y: ly,
            size: 7,
            font: this.fontBold,
            color: rgb(0.15, 0.18, 0.3),
          });
          ly -= 8.5;
        }
      }
      this.y -= rowH + 6;
    }
    this.y -= 4;
  }

  sectionTitle(text: string): void {
    this.ensure(20);
    this.page.drawText(text, {
      x: this.margin,
      y: this.y,
      size: 10,
      font: this.fontBold,
      color: PRIMARY,
    });
    this.y -= 14;
  }

  bullet(lines: string[]): void {
    const contentW = this.pageW - this.margin * 2 - 12;
    for (const line of lines) {
      const wrapped = fitLines(line, this.font, 8.5, contentW, 4);
      for (const ln of wrapped) {
        this.ensure(12);
        this.page.drawText(`• ${ln}`, {
          x: this.margin + 4,
          y: this.y,
          size: 8.5,
          font: this.font,
          color: rgb(0.2, 0.22, 0.28),
        });
        this.y -= 11;
      }
    }
    this.y -= 4;
  }

  /** Resmi cetvel — öğretmen / yönetici imza kutuları */
  signatureBlock(captions: [string, string]): void {
    this.ensure(58);
    const contentW = this.pageW - this.margin * 2;
    const gap = 14;
    const half = (contentW - gap) / 2;
    const boxH = 36;
    const yTop = this.y;
    for (let i = 0; i < 2; i++) {
      const x = this.margin + i * (half + gap);
      this.page.drawRectangle({
        x,
        y: yTop - boxH,
        width: half,
        height: boxH,
        borderColor: BORDER,
        borderWidth: 0.6,
      });
      this.page.drawText(captions[i] ?? '—', {
        x: x + 5,
        y: yTop - 12,
        size: 7,
        font: this.fontBold,
        color: rgb(0.15, 0.18, 0.28),
      });
      this.page.drawText('İmza', {
        x: x + 5,
        y: yTop - boxH + 6,
        size: 6.5,
        font: this.font,
        color: MUTED,
      });
    }
    this.y = yTop - boxH - 8;
    const stamp = new Date().toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    this.page.drawText(`Belge tarihi: ${stamp}`, {
      x: this.margin,
      y: this.y,
      size: 7,
      font: this.font,
      color: MUTED,
    });
    this.y -= 12;
  }

  table(
    headers: string[],
    rows: string[][],
    colWidths: number[],
    opts?: { maxLines?: number; headerMaxLines?: number },
  ): void {
    const contentW = this.pageW - this.margin * 2;
    const widths = scaleColWidths(colWidths, contentW);
    const tableW = widths.reduce((a, b) => a + b, 0);
    const cellPadX = 3;
    const cellPadY = 3;
    const fontSize = 6.5;
    const headerFontSize = 7;
    const lineH = 8.5;
    const maxLines = opts?.maxLines ?? 3;
    const headerMaxLines = opts?.headerMaxLines ?? 2;

    const linesInCell = (
      text: string,
      w: number,
      size: number,
      font: PDFFont,
      max: number,
    ): string[] => fitLines(String(text ?? '—'), font, size, Math.max(14, w - cellPadX * 2), max);

    const drawHeaderBand = (): number => {
      const counts = headers.map((h, i) =>
        linesInCell(h, widths[i] ?? 40, headerFontSize, this.fontBold, headerMaxLines).length,
      );
      const headerH = Math.max(15, Math.max(...counts, 1) * lineH + cellPadY * 2);
      this.page.drawRectangle({
        x: this.margin,
        y: this.y - headerH + 2,
        width: tableW,
        height: headerH,
        color: HEADER_BG,
        borderColor: BORDER,
        borderWidth: 0.4,
      });
      let x = this.margin;
      for (let i = 0; i < headers.length; i++) {
        const w = widths[i] ?? 40;
        const lines = linesInCell(headers[i]!, w, headerFontSize, this.fontBold, headerMaxLines);
        let ly = this.y - cellPadY - headerFontSize + 1;
        for (const ln of lines) {
          this.page.drawText(ln, {
            x: x + cellPadX,
            y: ly,
            size: headerFontSize,
            font: this.fontBold,
            color: rgb(0.15, 0.18, 0.28),
          });
          ly -= lineH;
        }
        x += w;
      }
      this.y -= headerH;
      return headerH;
    };

    const drawDataRow = (cells: string[], alt: boolean): void => {
      const cellTexts = headers.map((_, i) => cells[i] ?? '—');
      const lineCounts = cellTexts.map((c, i) =>
        linesInCell(c, widths[i] ?? 40, fontSize, this.font, maxLines).length,
      );
      const rowH = Math.max(12, Math.max(...lineCounts, 1) * lineH + cellPadY * 2);
      if (alt) {
        this.page.drawRectangle({
          x: this.margin,
          y: this.y - rowH + 2,
          width: tableW,
          height: rowH,
          color: ROW_ALT,
        });
      }
      let x = this.margin;
      for (let i = 0; i < cellTexts.length; i++) {
        const w = widths[i] ?? 40;
        const lines = linesInCell(cellTexts[i]!, w, fontSize, this.font, maxLines);
        let ly = this.y - cellPadY - fontSize + 1;
        for (const ln of lines) {
          this.page.drawText(ln, {
            x: x + cellPadX,
            y: ly,
            size: fontSize,
            font: this.font,
            color: rgb(0.15, 0.18, 0.28),
          });
          ly -= lineH;
        }
        x += w;
      }
      this.y -= rowH;
    };

    this.ensure(40);
    drawHeaderBand();

    for (let ri = 0; ri < rows.length; ri++) {
      if (this.y < this.margin + 36) {
        this.newPage();
        drawHeaderBand();
      }
      drawDataRow(rows[ri]!, ri % 2 === 1);
    }
    this.y -= 8;
  }

  async finish(): Promise<Buffer> {
    this.stampFooter();
    const bytes = await this.doc.save();
    return Buffer.from(bytes);
  }
}

@Injectable()
export class OptikReportPdfService {
  constructor(
    @InjectRepository(School)
    private readonly schoolRepo: Repository<School>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async resolveBranding(
    schoolId: string | null,
  ): Promise<{ schoolName: string; academicYear: string }> {
    if (!schoolId) {
      const b = resolveOptikPdfBranding(null, []);
      return b;
    }
    const school = await this.schoolRepo.findOne({
      where: { id: schoolId },
      select: ['name', 'principalName'],
    });
    const admins = await loadSchoolAdminsForOptikPdf(this.userRepo, schoolId);
    return resolveOptikPdfBranding(school, admins);
  }

  /** @deprecated resolveBranding kullanın */
  async resolveSchoolName(schoolId: string | null): Promise<string> {
    const b = await this.resolveBranding(schoolId);
    return b.schoolName;
  }

  sessionFilename(
    type: OptikSessionPdfType,
    title: string,
    studentId: string | undefined,
    report: SessionReportForPdf,
  ): string {
    const base = slugFilename(title);
    if (type === 'student' && studentId) {
      const row =
        report.combined_matrix.find((m) => m.student_id === studentId) ??
        report.matrix.find((m) => m.student_id === studentId);
      return `ogrenci-${slugFilename(row?.student_label ?? studentId)}.pdf`;
    }
    const names: Record<OptikSessionPdfType, string> = {
      class_list: `sinif-cetveli-${base}.pdf`,
      summary: `oturum-ozet-${base}.pdf`,
      item_analysis: `madde-analizi-${base}.pdf`,
      outcome: `kazanim-${base}.pdf`,
      student: 'ogrenci.pdf',
    };
    return names[type];
  }

  periodFilename(from?: string, to?: string): string {
    const f = from?.slice(0, 10) ?? '';
    const t = to?.slice(0, 10) ?? '';
    return f && t ? `optik-donem-${f}_${t}.pdf` : 'optik-donem-ozet.pdf';
  }

  async buildSession(
    type: OptikSessionPdfType,
    report: SessionReportForPdf,
    insights: OutcomeInsightsForPdf | null,
    branding: { schoolName: string; academicYear: string },
    studentId?: string,
  ): Promise<Buffer> {
    const pdf = new PdfLayout();
    await pdf.init();
    const meta = this.sessionMeta(report, branding.academicYear);
    const titles: Record<OptikSessionPdfType, string> = {
      class_list: 'Sınıf Puan Cetveli',
      summary: 'Sınav Oturumu Özet Raporu',
      item_analysis: 'Madde Analizi',
      outcome: 'Kazanım / Zayıf Madde Raporu',
      student: 'Öğrenci Sınav Karnesi',
    };
    pdf.header(branding.schoolName, titles[type], meta, branding.academicYear);

    switch (type) {
      case 'class_list':
        this.drawClassList(pdf, report);
        break;
      case 'summary':
        this.drawSummary(pdf, report);
        break;
      case 'item_analysis':
        this.drawItemAnalysis(pdf, report);
        break;
      case 'outcome':
        if (!insights) throw new BadRequestException('Kazanım verisi yok');
        this.drawOutcome(pdf, insights);
        break;
      case 'student':
        if (!studentId) throw new BadRequestException('student_id gerekli');
        this.drawStudent(pdf, report, studentId);
        break;
      default:
        throw new BadRequestException('Geçersiz PDF türü');
    }
    return pdf.finish();
  }

  async buildPeriod(
    data: PeriodReportForPdf,
    branding: { schoolName: string; academicYear: string },
    from?: string,
    to?: string,
  ): Promise<Buffer> {
    const pdf = new PdfLayout();
    await pdf.init();
    const range =
      from && to
        ? `${new Date(from).toLocaleDateString('tr-TR')} – ${new Date(to).toLocaleDateString('tr-TR')}`
        : 'Seçili dönem';
    pdf.header(branding.schoolName, 'Optik Dönem Özet Raporu', [
      { label: 'Eğitim yılı', value: branding.academicYear },
      { label: 'Dönem', value: range },
      { label: 'Toplam tarama', value: String(data.summary.total_scans) },
      { label: 'Çoktan seçmeli', value: String(data.summary.mc_scans) },
      { label: 'Açık uçlu', value: String(data.summary.open_scans) },
    ], branding.academicYear);

    pdf.sectionTitle('Özet göstergeler');
    pdf.bullet([
      `Ortalama net: ${data.summary.avg_net != null ? data.summary.avg_net : '—'}`,
      `Belirsiz okuma oranı: ${data.summary.ambiguous_rate != null ? `%${Math.round(data.summary.ambiguous_rate * 1000) / 10}` : '—'}`,
      `Ortalama açık puan %: ${data.summary.avg_grade_pct != null ? `%${Math.round(data.summary.avg_grade_pct)}` : '—'}`,
    ]);

    if (data.by_class.length) {
      pdf.sectionTitle('Sınıfa göre');
      pdf.table(
        ['Sınıf', 'Tarama', 'Belirsiz %'],
        data.by_class.slice(0, 40).map((c) => [
          c.class_name || '—',
          String(c.scans),
          String(Math.round(c.ambiguous_rate * 100)),
        ]),
        [180, 70, 70],
        { maxLines: 2 },
      );
    }

    if (data.by_subject.length) {
      pdf.sectionTitle('Derse göre');
      pdf.table(
        ['Ders', 'Tarama'],
        data.by_subject.slice(0, 30).map((s) => [s.subject_name || '—', String(s.scans)]),
        [360, 70],
        { maxLines: 2 },
      );
    }

    if (data.by_day.length) {
      pdf.sectionTitle('Günlük dağılım');
      pdf.table(
        ['Tarih', 'Toplam', 'MC', 'Açık'],
        data.by_day.slice(0, 45).map((d) => [
          d.date,
          String(d.scans),
          String(d.mc),
          String(d.open),
        ]),
        [110, 65, 65, 65],
      );
    }

    return pdf.finish();
  }

  private sessionMeta(
    report: SessionReportForPdf,
    academicYear: string,
  ): Array<{ label: string; value: string }> {
    const s = report.session;
    const exam =
      s.exam_date != null
        ? new Date(s.exam_date).toLocaleDateString('tr-TR')
        : '—';
    return [
      { label: 'Eğitim yılı', value: academicYear },
      { label: 'Oturum', value: s.title || '—' },
      { label: 'Sınıf / Ders', value: `${s.class_name ?? '—'} · ${s.subject_name ?? '—'}` },
      { label: 'Şablon', value: s.template_name || '—' },
      { label: 'Sınav tarihi', value: exam },
    ];
  }

  private drawClassList(pdf: PdfLayout, report: SessionReportForPdf): void {
    const rows = report.combined_matrix.length ? report.combined_matrix : report.matrix;
    const hasOpen = (report.session.open_questions?.length ?? 0) > 0;
    const headers = hasOpen
      ? ['Sıra', 'Öğrenci', 'D', 'Y', 'B', 'Net', 'Açık %']
      : ['Sıra', 'Öğrenci', 'D', 'Y', 'B', 'Net'];
    const widths = hasOpen
      ? [28, 168, 32, 32, 32, 42, 48]
      : [28, 188, 36, 36, 36, 48];
    const body = rows.map((m, i) => {
      const base = [
        String(i + 1),
        m.student_label ?? '—',
        String(m.correct ?? '—'),
        String(m.wrong ?? '—'),
        String(m.blank ?? '—'),
        String(m.net ?? '—'),
      ];
      if (hasOpen && 'open_pct' in m) {
        base.push(m.open_pct != null ? `%${m.open_pct}` : '—');
      }
      return base;
    });
    pdf.sectionTitle(`Katılımcılar (${rows.length})`);
    pdf.table(headers, body, widths, { maxLines: 2 });
    pdf.signatureBlock(['Sınıf öğretmeni', 'Okul yöneticisi']);
  }

  private drawSummary(pdf: PdfLayout, report: SessionReportForPdf): void {
    const sum = report.summary;
    pdf.sectionTitle('İstatistikler');
    pdf.bullet([
      `Toplam kayıt: ${sum.scanned_count} (MC: ${sum.mc_count}, açık: ${sum.open_count})`,
      `Ortalama net: ${sum.avg_net ?? '—'}`,
      `Eksik öğrenci: ${sum.missing_count}`,
      `Soru sayısı: ${report.session.question_count}`,
    ]);
    if (report.hardest_questions.length) {
      pdf.sectionTitle('En zor 5 soru');
      pdf.table(
        ['Soru', 'Doğru %', 'Sık yanlış'],
        report.hardest_questions.map((h) => [
          `S${h.question}`,
          `%${Math.round(h.correct_pct)}`,
          h.top_wrong_choice ?? '—',
        ]),
        [55, 75, 115],
      );
    }
  }

  private drawItemAnalysis(pdf: PdfLayout, report: SessionReportForPdf): void {
    if (!report.item_analysis.length) {
      pdf.bullet(['Anahtar girilmedi veya MC tarama yok.']);
      return;
    }
    pdf.sectionTitle('Madde düzeyi sonuçlar');
    pdf.table(
      ['Soru', 'Anahtar', 'Doğru%', 'Yanlış%', 'Boş%', 'En çok Y'],
      report.item_analysis.map((i) => [
        `S${i.question}`,
        i.key,
        String(i.correct_pct),
        String(i.wrong_pct),
        String(i.blank_pct),
        i.top_wrong_choice ?? '—',
      ]),
      [38, 38, 48, 48, 42, 48],
    );
  }

  private drawOutcome(pdf: PdfLayout, insights: OutcomeInsightsForPdf): void {
    if (insights.weak_outcomes.length) {
      pdf.sectionTitle('Zayıf kazanımlar / maddeler');
      pdf.table(
        ['Soru', 'Kazanım', 'Konu', 'Doğru%', 'Sık Y'],
        insights.weak_outcomes.map((w) => [
          `S${w.question}`,
          w.label || '—',
          w.konu || '—',
          String(w.correct_pct),
          w.top_wrong ?? '—',
        ]),
        [34, 150, 95, 48, 38],
        { maxLines: 3 },
      );
    }
    if (insights.unmapped_questions.length) {
      pdf.sectionTitle('Eşleşmemiş sorular');
      pdf.table(
        ['Soru', 'Doğru %'],
        insights.unmapped_questions.map((u) => [`S${u.question}`, String(u.correct_pct)]),
        [80, 80],
      );
    }
  }

  private drawStudent(pdf: PdfLayout, report: SessionReportForPdf, studentId: string): void {
    const row =
      report.combined_matrix.find((m) => m.student_id === studentId) ??
      report.matrix.find((m) => m.student_id === studentId);
    if (!row) throw new NotFoundException('Öğrenci bulunamadı');

    const studentTitle = row.student_label ?? 'Öğrenci';
    pdf.sectionTitle(studentTitle.length > 60 ? `${studentTitle.slice(0, 57)}…` : studentTitle);
    pdf.bullet([
      `Doğru: ${row.correct ?? '—'} · Yanlış: ${row.wrong ?? '—'} · Boş: ${row.blank ?? '—'} · Net: ${row.net ?? '—'}`,
    ]);

    const key = report.session.answer_key;
    const qCount = report.session.question_count;
    const answers = row.answers ?? [];
    const qRows: string[][] = [];
    for (let q = 1; q <= qCount; q++) {
      const k = normalizeKey(key, q);
      if (!k && !answers.find((a) => a.question === q)) continue;
      const a = answers.find((x) => x.question === q);
      const lbl = (a?.label ?? '').toUpperCase() || '—';
      const ok = k ? (lbl === k ? '✓' : lbl === '—' ? 'B' : '✗') : lbl;
      qRows.push([`S${q}`, lbl, k || '—', ok]);
    }
    if (qRows.length) {
      pdf.sectionTitle('Şık cevapları');
      pdf.table(['Soru', 'Cevap', 'Anahtar', ''], qRows, [50, 50, 50, 40]);
    }

    const combined = report.combined_matrix.find((m) => m.student_id === studentId);
    if (combined && (combined.open_score != null || combined.open_pct != null)) {
      pdf.bullet([
        `Açık uçlu puan: ${combined.open_score ?? '—'} / ${combined.open_max ?? '—'} (${combined.open_pct != null ? `%${combined.open_pct}` : '—'})`,
      ]);
    }
  }
}
