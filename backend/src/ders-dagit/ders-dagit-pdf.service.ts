import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fontkitRaw = require('@pdf-lib/fontkit');
const fontkit = fontkitRaw?.default ?? fontkitRaw;
import { PDFDocument, rgb } from 'pdf-lib';
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
    const sections = [...byClass.keys()].sort((a, b) => a.localeCompare(b, 'tr'));

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
}
