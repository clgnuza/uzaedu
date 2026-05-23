import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fontkitRaw = require('@pdf-lib/fontkit');
const fontkit = fontkitRaw?.default ?? fontkitRaw;
import { PDFDocument } from 'pdf-lib';
import { compareClassSections } from './class-section-sort';
import { DAY_LABELS, type ExportEntry } from './ders-dagit.export';
import { scheduleCellAbbrevLines, scheduleCellLinesForView, type SchedulePrintView } from './ders-dagit-pdf-abbrev';
import {
  beginProPage,
  buildScheduleGrid,
  drawCenteredText,
  drawCellText,
  drawPageFooter,
  drawScheduleTable,
  paletteFor,
  resolveScheduleRowHeight,
  type PdfHeaderInfo,
  type PdfPrintTheme,
} from './ders-dagit-pdf-layout';
import { drawSignatureBlock } from './ders-dagit-pdf-brand';
import {
  buildDutyReportPdf,
  buildDualEducationPdf,
  buildExtraLessonPdf,
  type DutySlotRow,
  type DualClassRow,
  type ExtraLessonRow,
} from './ders-dagit-pdf-reports';
import {
  contentBottom,
  fitMasterRowHeight,
  fitScheduleRowHeight,
  masterRowsPerPage,
  PDF_COMPACT_HEADER_RESERVE,
  PDF_HEADER_RESERVE,
} from './ders-dagit-pdf-space';
import {
  buildMasterRows,
  drawMasterSheetPage,
  MASTER_PAGE_SIZE,
  paginateMasterRows,
  type MasterSheetAxis,
} from './ders-dagit-pdf-master';
import {
  appendTeacherNotificationPages,
  groupEntriesByTeacher,
  type TeacherNotificationTexts,
} from './ders-dagit-pdf-teacher-notification';
import {
  drawOfficialLetterhead,
  formatOfficialDate,
} from './ders-dagit-pdf-official-letter';
import {
  formatOgretimYiliForProse,
  isPlaceholderTeacherLabel,
} from './ders-dagit-notification-texts';
import { buildCouncilPdfDocument, type CouncilPdfOpts } from './ders-dagit-pdf-council';

function getDejaVuFontPaths(): { sans: string; bold: string } {
  try {
    return {
      sans: require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans.ttf'),
      bold: require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf'),
    };
  } catch {
    const base = join(process.cwd(), 'node_modules', 'dejavu-fonts-ttf', 'ttf');
    return { sans: join(base, 'DejaVuSans.ttf'), bold: join(base, 'DejaVuSans-Bold.ttf') };
  }
}

type PdfFonts = { doc: PDFDocument; font: Awaited<ReturnType<PDFDocument['embedFont']>>; fontBold: Awaited<ReturnType<PDFDocument['embedFont']>> };

@Injectable()
export class DersDagitPdfService {
  private async loadFonts(): Promise<PdfFonts> {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const fp = getDejaVuFontPaths();
    const font = await doc.embedFont(readFileSync(fp.sans));
    const fontBold = await doc.embedFont(readFileSync(fp.bold));
    return { doc, font, fontBold };
  }

  private drawWeeklyScheduleOnPage(
    page: import('pdf-lib').PDFPage,
    pageW: number,
    pageH: number,
    margin: number,
    headerInfo: PdfHeaderInfo,
    gridEntries: Array<{ day_of_week: number; lesson_num: number; lines: string[] }>,
    font: PdfFonts['font'],
    fontBold: PdfFonts['fontBold'],
    pal: ReturnType<typeof paletteFor>,
    colorMode: boolean,
    footer?: { footer_note?: string | null; pageNum?: number; pageTotal?: number },
  ): void {
    const bottomY = contentBottom(margin);
    const hourColW = 44;
    const tableW = pageW - 2 * margin - 8;
    const yAfterHeader = beginProPage(page, pageW, pageH, margin, font, fontBold, headerInfo, pal);
    const { days, lessons, cells } = buildScheduleGrid(gridEntries, [1, 2, 3, 4, 5]);
    const colW = (tableW - hourColW) / days.length;
    const rowH = resolveScheduleRowHeight(
      yAfterHeader,
      bottomY,
      lessons.length,
      days,
      lessons,
      cells,
      colW,
      font,
    );
    drawScheduleTable(
      page,
      margin + 4,
      yAfterHeader,
      tableW,
      hourColW,
      rowH,
      days,
      lessons,
      cells,
      font,
      fontBold,
      pal,
      '—',
      colorMode,
    );
    if (footer) {
      drawPageFooter(page, margin, pageW, font, pal, footer);
    }
  }

  /** Editör yazdırma — tek sınıf / öğretmen / derslik (yatay A4, rapor PDF ile aynı şablon) */
  async buildScheduleViewPdf(
    header: PdfHeaderInfo,
    entries: ExportEntry[],
    view: SchedulePrintView,
    entityLabel: string,
    theme: PdfPrintTheme = 'color',
  ): Promise<Uint8Array> {
    const { doc, font, fontBold } = await this.loadFonts();
    const pal = paletteFor(theme);
    const pageW = 842;
    const pageH = 595;
    const margin = 48;
    const titles: Record<SchedulePrintView, string> = {
      class: 'HAFTALIK DERS PROGRAMI ÇİZELGESİ',
      teacher: 'ÖĞRETMEN HAFTALIK DERS PROGRAMI',
      room: 'DERSLİK HAFTALIK PROGRAMI',
    };
    const page = doc.addPage([pageW, pageH]);
    const gridEntries = entries.map((e) => ({
      day_of_week: e.day_of_week,
      lesson_num: e.lesson_num,
      lines: scheduleCellLinesForView(e, view),
    }));
    const headerInfo: PdfHeaderInfo = {
      ...header,
      document_title: titles[view],
      class_section: view === 'class' ? entityLabel : header.class_section,
      subtitle: view !== 'class' ? entityLabel : header.subtitle,
    };
    if (!gridEntries.length) {
      beginProPage(page, pageW, pageH, margin, font, fontBold, headerInfo, pal);
      drawCenteredText(
        page,
        'Bu görünümde yerleşmiş ders saati bulunmuyor.',
        margin,
        pageH / 2,
        pageW - 2 * margin,
        font,
        10,
        pal.muted,
      );
    } else {
      this.drawWeeklyScheduleOnPage(page, pageW, pageH, margin, headerInfo, gridEntries, font, fontBold, pal, theme === 'color', {
        footer_note: header.footer_note,
        pageNum: 1,
        pageTotal: 1,
      });
    }
    return doc.save();
  }

  /** Okul — tüm şubeler, şube başına resmi haftalık çizelge (yatay A4) */
  async buildProgramPdf(
    header: PdfHeaderInfo,
    entries: ExportEntry[],
    theme: PdfPrintTheme = 'color',
  ): Promise<Uint8Array> {
    const { doc, font, fontBold } = await this.loadFonts();
    const pal = paletteFor(theme);
    const pageW = 842;
    const pageH = 595;
    const margin = 48;

    const byClass = new Map<string, ExportEntry[]>();
    for (const e of entries) {
      const arr = byClass.get(e.class_section) ?? [];
      arr.push(e);
      byClass.set(e.class_section, arr);
    }
    const sections = [...byClass.keys()].sort(compareClassSections);

    let pageIndex = 0;
    for (const sec of sections) {
      pageIndex += 1;
      const page = doc.addPage([pageW, pageH]);
      const rows = byClass.get(sec) ?? [];
      const gridEntries = rows.map((e) => ({
        day_of_week: e.day_of_week,
        lesson_num: e.lesson_num,
        lines: scheduleCellAbbrevLines(e),
      }));
      const headerInfo: PdfHeaderInfo = {
        ...header,
        document_title: 'HAFTALIK DERS PROGRAMI ÇİZELGESİ',
        class_section: sec,
      };
      this.drawWeeklyScheduleOnPage(page, pageW, pageH, margin, headerInfo, gridEntries, font, fontBold, pal, theme === 'color', {
        footer_note: header.footer_note,
        pageNum: pageIndex,
        pageTotal: sections.length,
      });
    }

    if (!sections.length) {
      const page = doc.addPage([pageW, pageH]);
      beginProPage(page, pageW, pageH, margin, font, fontBold, header, pal);
      drawCenteredText(
        page,
        'Programda yerleşmiş ders saati bulunmuyor.',
        margin,
        pageH / 2,
        pageW - 2 * margin,
        font,
        10,
        pal.muted,
      );
    }

    return doc.save();
  }

  /** Veli — tek şube, öğretmen adı yok (dikey A4, MEB ızgara) */
  async buildParentClassPdf(
    header: PdfHeaderInfo,
    classSection: string,
    entries: ExportEntry[],
    theme: PdfPrintTheme = 'color',
    maxLesson = 8,
  ): Promise<Uint8Array> {
    const { doc, font, fontBold } = await this.loadFonts();
    const pal = paletteFor(theme);
    const pageW = 595;
    const pageH = 842;
    const margin = 48;
    const bottomY = contentBottom(margin);
    const hourColW = 42;
    const tableW = pageW - 2 * margin - 8;
    const page = doc.addPage([pageW, pageH]);

    const filtered = entries.filter((e) => e.class_section === classSection);
    const gridEntries = filtered.map((e) => ({
      day_of_week: e.day_of_week,
      lesson_num: e.lesson_num,
      lines: [e.subject],
    }));
    const { days, lessons, cells } = buildScheduleGrid(gridEntries, [1, 2, 3, 4, 5], maxLesson);

    const headerInfo: PdfHeaderInfo = {
      ...header,
      document_title: 'HAFTALIK DERS PROGRAMI',
      class_section: classSection,
      subtitle: header.subtitle ?? 'Veli bilgilendirme çıktısı',
    };
    const yAfterHeader = beginProPage(page, pageW, pageH, margin, font, fontBold, headerInfo, pal);
    const rowH = fitScheduleRowHeight(yAfterHeader, bottomY + 70, lessons.length, 30);
    const tableBottom = drawScheduleTable(
      page,
      margin + 4,
      yAfterHeader,
      tableW,
      hourColW,
      rowH,
      days,
      lessons,
      cells,
      font,
      fontBold,
      pal,
      '—',
      theme === 'color',
    );

    const sigTop = Math.max(tableBottom - 12, bottomY + 64);
    drawSignatureBlock(page, margin + 4, sigTop, 220, 'Okul Müdürü', undefined, font, fontBold, pal);

    drawPageFooter(page, margin, pageW, font, pal, { footer_note: header.footer_note });
    return doc.save();
  }

  /** Kapak sayfası — resmi antet (önizleme / yazdır) */
  async buildCoverPdf(
    header: PdfHeaderInfo,
    opts: {
      address?: string | null;
      phone?: string | null;
      principal_name?: string | null;
      body_note?: string | null;
    },
    theme: PdfPrintTheme = 'color',
  ): Promise<Uint8Array> {
    const { doc, font, fontBold } = await this.loadFonts();
    const pal = paletteFor(theme);
    const pageW = 595;
    const pageH = 842;
    const margin = 52;
    const page = doc.addPage([pageW, pageH]);
    let y = beginProPage(page, pageW, pageH, margin, font, fontBold, header, pal);

    const drawLine = (text: string, size: number) => {
      page.drawText(text.slice(0, 92), { x: margin + 8, y, size, font, color: pal.muted });
      y -= size + 8;
    };
    if (opts.address?.trim()) drawLine(opts.address.trim(), 9);
    if (opts.phone?.trim()) drawLine(`Tel: ${opts.phone.trim()}`, 9);
    if (opts.principal_name?.trim()) drawLine(`Müdür: ${opts.principal_name.trim()}`, 9);

    const note =
      opts.body_note?.trim() || 'Bu belge okul ders dağıtım programının resmi çıktısıdır.';
    drawCenteredText(page, note, margin, pageH * 0.44, pageW - 2 * margin, font, 11, pal.ink);
    const dateStr = new Date().toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    drawCenteredText(page, `Tarih: ${dateStr}`, margin, pageH * 0.38, pageW - 2 * margin, font, 10, pal.muted);

    drawPageFooter(page, margin, pageW, font, pal, { footer_note: header.footer_note });
    return doc.save();
  }

  /** Kurul onay bloğu — tek sayfa (önizleme / yazdır) */
  async buildApprovalPdf(
    opts: {
      school_name: string;
      program_name: string;
      academic_year?: string | null;
      approval_text?: string | null;
      principal_name?: string | null;
      principal_signature_label?: string | null;
      footer_note?: string | null;
    },
    theme: PdfPrintTheme = 'color',
  ): Promise<Uint8Array> {
    const { doc, font, fontBold } = await this.loadFonts();
    const pal = paletteFor(theme);
    const pageW = 595;
    const pageH = 842;
    const margin = 52;
    const bottomY = contentBottom(margin);
    const page = doc.addPage([pageW, pageH]);

    const header: PdfHeaderInfo = {
      school_name: opts.school_name,
      document_title: 'ZÜMRE ÖĞRETMENLER KURULU — ONAY',
      subtitle: opts.program_name,
      academic_year: opts.academic_year,
      footer_note: opts.footer_note,
    };
    let y = beginProPage(page, pageW, pageH, margin, font, fontBold, header, pal);
    y -= 12;

    const approval =
      opts.approval_text?.trim() ||
      'Karar: Okulumuzda uygulanacak haftalık ders programı, Zümre Öğretmenler Kurulu\'nca incelenmiş; öğretim planına ve ilgili mevzuata uygun bulunarak onaylanmıştır.';
    const boxH = 72;
    const boxY = y - boxH;
    page.drawRectangle({
      x: margin + 8,
      y: boxY,
      width: pageW - 2 * margin - 16,
      height: boxH,
      color: pal.accentSoft,
      borderColor: pal.accent,
      borderWidth: 0.4,
    });
    let ay = boxY + boxH - 18;
    for (const line of approval.match(/.{1,85}(\s|$)/g) ?? [approval]) {
      page.drawText(line.trim().slice(0, 90), {
        x: margin + 16,
        y: ay,
        size: 8.5,
        font,
        color: pal.ink,
      });
      ay -= 11;
      if (ay < boxY + 8) break;
    }

    const sigW = (pageW - 2 * margin - 32) / 3;
    const sigTop = bottomY + 118;
    const principalLabel = opts.principal_signature_label?.trim() || 'Okul Müdürü';
    drawSignatureBlock(
      page,
      margin + 8,
      sigTop,
      sigW,
      principalLabel,
      opts.principal_name ?? undefined,
      font,
      fontBold,
      pal,
    );
    drawSignatureBlock(page, margin + 16 + sigW, sigTop, sigW, 'Zümre Başkanı', undefined, font, fontBold, pal);
    drawSignatureBlock(page, margin + 24 + sigW * 2, sigTop, sigW, 'İdareci', undefined, font, fontBold, pal);

    drawPageFooter(page, margin, pageW, font, pal, { footer_note: opts.footer_note });
    return doc.save();
  }

  /** Zümre kurulu tutanağı — resmi tutanak (MEB örneklerine uygun bölümler) */
  async buildCouncilPdf(opts: CouncilPdfOpts, theme: PdfPrintTheme = 'color'): Promise<Uint8Array> {
    const { doc, font, fontBold } = await this.loadFonts();
    return buildCouncilPdfDocument(doc, { font, fontBold }, opts, theme);
  }

  /** Bilsa / aSc tarzı toplu çarşaf liste (A3 yatay) */
  async buildMasterSheetPdf(
    header: PdfHeaderInfo,
    entries: ExportEntry[],
    axis: MasterSheetAxis,
    theme: PdfPrintTheme = 'color',
  ): Promise<Uint8Array> {
    const { doc, font, fontBold } = await this.loadFonts();
    const [pageW, pageH] = MASTER_PAGE_SIZE;
    const margin = 48;
    const { rowLabels, cells, workDays, maxLesson } = buildMasterRows(entries, axis);
    const lessons = Math.min(10, maxLesson);
    const headerH = PDF_COMPACT_HEADER_RESERVE;
    const preferRowH = 36;
    const perPage = masterRowsPerPage(pageH, margin, headerH, preferRowH);
    const rowH = fitMasterRowHeight(pageH, margin, headerH, perPage, preferRowH);
    const slices = paginateMasterRows(rowLabels, perPage);

    if (!slices[0]?.length) {
      const page = doc.addPage(MASTER_PAGE_SIZE);
      drawMasterSheetPage(
        page,
        pageW,
        pageH,
        margin,
        font,
        fontBold,
        header,
        axis,
        [],
        cells,
        workDays,
        lessons,
        theme,
        1,
        1,
        rowH,
      );
      return doc.save();
    }

    slices.forEach((rows, idx) => {
      const page = doc.addPage(MASTER_PAGE_SIZE);
      drawMasterSheetPage(
        page,
        pageW,
        pageH,
        margin,
        font,
        fontBold,
        header,
        axis,
        rows,
        cells,
        workDays,
        lessons,
        theme,
        idx + 1,
        slices.length,
        rowH,
      );
    });
    return doc.save();
  }

  async buildDutyPdf(
    header: PdfHeaderInfo,
    slots: DutySlotRow[],
    workDays: number[],
    theme: PdfPrintTheme,
  ): Promise<Uint8Array> {
    const { doc, font, fontBold } = await this.loadFonts();
    await buildDutyReportPdf(doc, font, fontBold, header, slots, workDays, theme);
    return doc.save();
  }

  async buildDualPdf(
    header: PdfHeaderInfo,
    rows: DualClassRow[],
    dualEnabled: boolean,
    pmFirst: number,
    theme: PdfPrintTheme,
  ): Promise<Uint8Array> {
    const { doc, font, fontBold } = await this.loadFonts();
    await buildDualEducationPdf(doc, font, fontBold, header, rows, dualEnabled, pmFirst, theme);
    return doc.save();
  }

  async buildExtraLessonSummaryPdf(
    header: PdfHeaderInfo,
    rows: ExtraLessonRow[],
    programName: string,
    theme: PdfPrintTheme,
  ): Promise<Uint8Array> {
    const { doc, font, fontBold } = await this.loadFonts();
    await buildExtraLessonPdf(doc, font, fontBold, header, rows, programName, theme);
    return doc.save();
  }

  /** Öğretmene tebliğ tutanağı — öğretmen başına bir sayfa */
  async buildTeacherNotificationPdf(
    header: PdfHeaderInfo,
    entries: ExportEntry[],
    texts: TeacherNotificationTexts,
    opts: {
      school_name: string;
      academic_year?: string | null;
      program_name: string;
      principal_name?: string | null;
      teacher_filter?: string | null;
      branch_by_key?: Map<string, string | null>;
      display_by_key?: Map<string, string>;
    },
    theme: PdfPrintTheme = 'color',
    workDays: number[] = [1, 2, 3, 4, 5],
  ): Promise<Uint8Array> {
    const { doc, font, fontBold } = await this.loadFonts();
    let teachers = groupEntriesByTeacher(entries);
    for (const t of teachers) {
      const display =
        opts.display_by_key?.get(t.key) ??
        (isPlaceholderTeacherLabel(t.label) ? opts.display_by_key?.get(t.label) : undefined);
      if (display?.trim()) t.label = display.trim();
      t.branch =
        opts.branch_by_key?.get(t.key) ??
        opts.branch_by_key?.get(t.label) ??
        null;
    }
    const filter = opts.teacher_filter?.trim().toLocaleLowerCase('tr');
    if (filter) {
      teachers = teachers.filter(
        (t) =>
          t.key.toLocaleLowerCase('tr').includes(filter) ||
          t.label.toLocaleLowerCase('tr').includes(filter),
      );
    }
    if (!teachers.length) {
      const page = doc.addPage([595, 842]);
      const pal = paletteFor(theme);
      const margin = 52;
      drawOfficialLetterhead(page, 595, 842, margin, font, fontBold, {
        school_name: opts.school_name,
        document_title: texts.notification_title?.trim() || 'ÖĞRETMEN DERS PROGRAMI TEBLİĞ TUTANAĞI',
        academic_year: opts.academic_year,
      }, pal);
      drawCenteredText(
        page,
        'Tebliğ edilecek öğretmen veya ders saati bulunamadı.',
        margin,
        380,
        595 - 2 * margin,
        font,
        10,
        pal.muted,
      );
      return doc.save();
    }
    const dateStr = formatOfficialDate();
    const placeholders = {
      '{{okul_adi}}': opts.school_name,
      '{{ogretim_yili}}': formatOgretimYiliForProse(opts.academic_year),
      '{{program_adi}}': opts.program_name,
      '{{tarih}}': dateStr,
      '{{mudur_adi}}': opts.principal_name?.trim() || '_________________________',
      '{{ogretmen_adi}}': '',
      '{{brans}}': '',
      '{{sayi}}': '',
      '{{konu}}': texts.notification_subject?.trim() || '',
    };
    appendTeacherNotificationPages(
      doc,
      font,
      fontBold,
      header,
      teachers,
      texts,
      placeholders,
      workDays,
      theme,
    );
    return doc.save();
  }
}
