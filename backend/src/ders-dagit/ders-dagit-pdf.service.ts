import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fontkitRaw = require('@pdf-lib/fontkit');
const fontkit = fontkitRaw?.default ?? fontkitRaw;
import { PDFDocument, rgb } from 'pdf-lib';
import { compareClassSections } from './class-section-sort';
import { DAY_LABELS, type ExportEntry } from './ders-dagit.export';

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

@Injectable()
export class DersDagitPdfService {
  async buildProgramPdf(title: string, entries: ExportEntry[]): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const fp = getDejaVuFontPaths();
    const font = await doc.embedFont(readFileSync(fp.sans));
    const fontBold = await doc.embedFont(readFileSync(fp.bold));

    const byClass = new Map<string, ExportEntry[]>();
    for (const e of entries) {
      const arr = byClass.get(e.class_section) ?? [];
      arr.push(e);
      byClass.set(e.class_section, arr);
    }
    const sections = [...byClass.keys()].sort(compareClassSections);

    const pageW = 842;
    const pageH = 595;
    const margin = 36;
    let page = doc.addPage([pageW, pageH]);
    let y = pageH - margin;

    const newPage = () => {
      page = doc.addPage([pageW, pageH]);
      y = pageH - margin;
    };

    const line = (text: string, size: number, bold = false) => {
      if (y < margin + 20) newPage();
      page.drawText(text.slice(0, 120), {
        x: margin,
        y,
        size,
        font: bold ? fontBold : font,
        color: rgb(0.1, 0.1, 0.15),
      });
      y -= size + 4;
    };

    line(title, 14, true);
    line(`Üretim: ${new Date().toLocaleString('tr-TR')}`, 9);

    for (const sec of sections) {
      const rows = (byClass.get(sec) ?? []).sort(
        (a, b) => a.day_of_week - b.day_of_week || a.lesson_num - b.lesson_num,
      );
      if (y < margin + 80) newPage();
      line(sec, 11, true);
      for (const e of rows) {
        const day = DAY_LABELS[e.day_of_week] ?? String(e.day_of_week);
        line(
          `  ${day} · ${e.lesson_num}. saat — ${e.subject}${e.teacher_label ? ` (${e.teacher_label})` : ''}${e.room_name ? ` · ${e.room_name}` : ''}`,
          8,
        );
      }
      y -= 6;
    }

    return doc.save();
  }

  /** Veli — tek şube, öğretmen adı yok, haftalık ızgara */
  async buildParentClassPdf(
    title: string,
    classSection: string,
    entries: ExportEntry[],
    maxLesson = 8,
  ): Promise<Uint8Array> {
    const filtered = entries.filter((e) => e.class_section === classSection);
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const fp = getDejaVuFontPaths();
    const font = await doc.embedFont(readFileSync(fp.sans));
    const fontBold = await doc.embedFont(readFileSync(fp.bold));
    const pageW = 595;
    const pageH = 842;
    const page = doc.addPage([pageW, pageH]);
    const margin = 40;
    let y = pageH - margin;
    const draw = (text: string, size: number, bold = false) => {
      page.drawText(text.slice(0, 100), {
        x: margin,
        y,
        size,
        font: bold ? fontBold : font,
        color: rgb(0.1, 0.1, 0.15),
      });
      y -= size + 6;
    };
    draw(title, 14, true);
    draw(`${classSection} — Haftalık ders programı`, 11, true);
    draw(`Tarih: ${new Date().toLocaleDateString('tr-TR')}`, 9);
    y -= 8;

    const days = [1, 2, 3, 4, 5];
    const cellW = (pageW - 2 * margin - 40) / days.length;
    const startY = y;
    const rowH = 22;
    page.drawText('Saat', { x: margin, y: startY, size: 8, font: fontBold });
    for (let di = 0; di < days.length; di++) {
      const label = DAY_LABELS[days[di]!]?.slice(0, 3) ?? String(days[di]);
      page.drawText(label, {
        x: margin + 40 + di * cellW + 4,
        y: startY,
        size: 8,
        font: fontBold,
      });
    }
    y = startY - rowH;
    const byKey = new Map<string, string>();
    for (const e of filtered) {
      byKey.set(`${e.day_of_week}-${e.lesson_num}`, e.subject);
    }
    for (let les = 1; les <= maxLesson; les++) {
      page.drawText(String(les), { x: margin, y: y + 4, size: 8, font });
      for (let di = 0; di < days.length; di++) {
        const sub = byKey.get(`${days[di]}-${les}`) ?? '—';
        page.drawText(sub.slice(0, 18), {
          x: margin + 40 + di * cellW + 2,
          y: y + 4,
          size: 7,
          font,
        });
      }
      y -= rowH;
    }
    return doc.save();
  }

  /** Kurul tutanağı — özet + imza alanları */
  async buildCouncilPdf(opts: {
    school_name: string;
    program_name: string;
    academic_year?: string | null;
    score: number | null;
    entry_count: number;
    class_count: number;
    teacher_count: number;
    violations: string[];
    by_class: Array<{ section: string; weekly_slots: number }>;
  }): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const fp = getDejaVuFontPaths();
    const font = await doc.embedFont(readFileSync(fp.sans));
    const fontBold = await doc.embedFont(readFileSync(fp.bold));
    const pageW = 595;
    const pageH = 842;
    let page = doc.addPage([pageW, pageH]);
    let y = pageH - 50;
    const line = (text: string, size: number, bold = false) => {
      if (y < 80) {
        page = doc.addPage([pageW, pageH]);
        y = pageH - 50;
      }
      page.drawText(text.slice(0, 110), {
        x: 50,
        y,
        size,
        font: bold ? fontBold : font,
      });
      y -= size + 5;
    };
    line('ZÜMRE ÖĞRETMENLER KURULU — DERS PROGRAMI TUTANAĞI', 12, true);
    line(opts.school_name, 11, true);
    line(`Program: ${opts.program_name}`, 10);
    if (opts.academic_year) line(`Öğretim yılı: ${opts.academic_year}`, 9);
    line(`Tarih: ${new Date().toLocaleDateString('tr-TR')}`, 9);
    y -= 6;
    line(`Toplam yerleşim: ${opts.entry_count} · Şube: ${opts.class_count} · Öğretmen: ${opts.teacher_count}`, 9);
    if (opts.score != null) line(`Program skoru: ${opts.score}`, 9);
    if (opts.violations.length) {
      line('Üretim uyarıları:', 9, true);
      for (const v of opts.violations.slice(0, 8)) line(`  • ${v}`, 8);
    }
    y -= 4;
    line('Şube özeti:', 9, true);
    for (const row of opts.by_class.slice(0, 40)) {
      line(`  ${row.section}: ${row.weekly_slots} ders saati`, 8);
    }
    y -= 20;
    line('Karar: Okulda uygulanacak ders dağıtım programı kurulca incelenmiş ve onaylanmıştır.', 9);
    y -= 30;
    line('Okul Müdürü: _________________________', 9);
    y -= 24;
    line('Zümre Başkanı: _________________________', 9);
    y -= 24;
    line('İnsan Kaynakları / İdareci: _________________________', 9);
    return doc.save();
  }
}
