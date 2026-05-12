import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fontkitRaw = require('@pdf-lib/fontkit');
const fontkit = fontkitRaw?.default ?? fontkitRaw;
import { PDFDocument, rgb } from 'pdf-lib';

function getDejaVuFontPaths(): { sans: string; bold: string } {
  try {
    const sans = require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans.ttf');
    const bold = require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf');
    return { sans, bold };
  } catch {
    const cwd = process.cwd();
    const base = join(cwd, 'node_modules', 'dejavu-fonts-ttf', 'ttf');
    return {
      sans: join(base, 'DejaVuSans.ttf'),
      bold: join(base, 'DejaVuSans-Bold.ttf'),
    };
  }
}

export interface YollukOfficialPdfInput {
  schoolName: string;
  teacherName: string;
  preparerName: string;
  calculation: {
    id: string;
    kind: string;
    status: string;
    title: string | null;
    created_at: Date;
    finalized_at: Date | null;
    inputs: Record<string, unknown>;
    result: { total_tl?: number; lines?: Array<{ key: string; label: string; amount_tl: number }> };
    rules_snapshot: Record<string, unknown>;
  };
}

@Injectable()
export class YollukPdfService {
  async buildOfficialReportPdf(data: YollukOfficialPdfInput): Promise<Buffer> {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const fp = getDejaVuFontPaths();
    const font = await doc.embedFont(readFileSync(fp.sans));
    const fontBold = await doc.embedFont(readFileSync(fp.bold));

    const pageW = 595;
    const pageH = 842;
    const margin = 48;
    const maxW = pageW - margin * 2;
    let page = doc.addPage([pageW, pageH]);
    let y = pageH - margin;

    const fmt = (d: Date) =>
      d.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'short', timeStyle: 'short' });

    const newPage = () => {
      page = doc.addPage([pageW, pageH]);
      y = pageH - margin;
    };

    const title = (t: string, size = 14) => {
      if (y < margin + 80) newPage();
      page.drawText(t, { x: margin, y, size, font: fontBold, color: rgb(0.1, 0.1, 0.15) });
      y -= size + 10;
    };

    const preChunk = (s: string, n: number) => {
      const parts: string[] = [];
      for (let i = 0; i < s.length; i += n) parts.push(s.slice(i, i + n));
      return parts.join('\n');
    };

    const wrapLines = (text: string, size: number): string[] => {
      const out: string[] = [];
      for (const paragraph of text.split('\n')) {
        const words = paragraph.split(/\s+/).filter(Boolean);
        let line = '';
        for (const w of words) {
          const test = line ? `${line} ${w}` : w;
          if (font.widthOfTextAtSize(test, size) <= maxW) line = test;
          else {
            if (line) out.push(line);
            line = w;
          }
        }
        if (line) out.push(line);
        if (words.length === 0) out.push('');
      }
      return out.length ? out : [''];
    };

    const body = (text: string, size = 10) => {
      const lines = wrapLines(text, size);
      const lh = size + 3;
      for (const ln of lines) {
        if (y < margin + lh) newPage();
        page.drawText(ln, { x: margin, y, size, font, color: rgb(0.15, 0.15, 0.2) });
        y -= lh;
      }
      y -= 4;
    };

    const wrapLinesW = (text: string, size: number, width: number): string[] => {
      const out: string[] = [];
      for (const paragraph of text.split('\n')) {
        const words = paragraph.split(/\s+/).filter(Boolean);
        let line = '';
        for (const w of words) {
          const test = line ? `${line} ${w}` : w;
          if (font.widthOfTextAtSize(test, size) <= width) line = test;
          else {
            if (line) out.push(line);
            line = w;
          }
        }
        if (line) out.push(line);
        if (words.length === 0) out.push('');
      }
      return out.length ? out : [''];
    };

    const row2 = (a: string, b: string, size = 9) => {
      const colX = margin + 150;
      const colW = maxW - 150;
      const bLines = wrapLinesW(b, size, colW);
      const lh = size + 4;
      const blockH = Math.max(lh, bLines.length * lh);
      if (y < margin + blockH + 8) newPage();
      page.drawText(a, { x: margin, y, size, font: fontBold, color: rgb(0.2, 0.2, 0.25) });
      let yy = y;
      for (const ln of bLines) {
        page.drawText(ln, { x: colX, y: yy, size, font, color: rgb(0.15, 0.15, 0.2) });
        yy -= lh;
      }
      y -= Math.max(lh + 4, bLines.length * lh + 4);
    };

    title('Yurt içi yolluk hesap raporu (özet)');
    body(
      'Bu belge bilgi amaçlı özet rapordur. Ödeme ve kesin haklar için kurumunuzun mali işler birimi ve 6245 sayılı Harcırah Kanunu ile ilgili mevzuat esas alınır.',
      9,
    );

    const c = data.calculation;
    row2('Okul:', data.schoolName || '—');
    row2('Rapor tarihi:', fmt(new Date()));
    row2('Kayıt no:', c.id);
    row2('Durum:', c.status === 'final' ? 'Kesinleşti' : 'Taslak');
    row2('Hesap türü:', c.kind === 'gecici' ? 'Geçici görev (özet)' : 'Sürekli görev — yer değiştirme (özet)');
    if (c.title?.trim()) row2('Başlık:', c.title.trim());
    row2('Oluşturulma:', fmt(new Date(c.created_at)));
    if (c.finalized_at) row2('Kesinleşme:', fmt(new Date(c.finalized_at)));
    row2('Öğretmen:', data.teacherName || '—');
    row2('Hazırlayan:', data.preparerName || '—');

    y -= 6;
    title('Parametre özeti (anlık görüntü)', 11);
    body(preChunk(JSON.stringify(c.rules_snapshot, null, 2), 72), 8);

    y -= 4;
    title('Girdiler', 11);
    body(preChunk(JSON.stringify(c.inputs, null, 2), 72), 8);

    y -= 4;
    title('Hesap satırları', 11);
    const eff = (c.result as { effective_daily_tl?: number })?.effective_daily_tl;
    if (eff != null && Number.isFinite(eff)) {
      row2('Kullanılan gündelik (iç yevmiye)', `${eff.toFixed(2)} TL`, 9);
    }
    for (const line of c.result?.lines ?? []) {
      row2(line.label, `${line.amount_tl.toFixed(2)} TL`, 9);
    }
    y -= 4;
    row2('GENEL TOPLAM', `${(c.result?.total_tl ?? 0).toFixed(2)} TL`, 11);

    y -= 16;
    body(`Kural sürümü (kayıt): ${String(c.rules_snapshot?.rules_version ?? '—')}`, 8);

    const pdf = await doc.save();
    return Buffer.from(pdf);
  }
}
