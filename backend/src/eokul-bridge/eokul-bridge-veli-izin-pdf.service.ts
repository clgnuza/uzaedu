import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { readFileSync } from 'fs';
import { join } from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fontkitRaw = require('@pdf-lib/fontkit');
const fontkit = fontkitRaw?.default ?? fontkitRaw;
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { School } from '../schools/entities/school.entity';
import type { VeliIzinPdfDto } from './dto/veli-izin-pdf.dto';

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
export class EokulBridgeVeliIzinPdfService {
  constructor(
    @InjectRepository(School)
    private readonly schoolRepo: Repository<School>,
  ) {}

  async generatePdf(schoolId: string, body: VeliIzinPdfDto): Promise<Buffer> {
    const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
    if (!school) throw new NotFoundException('Okul bulunamadı.');

    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const fp = getDejaVuFontPaths();
    const font = await doc.embedFont(readFileSync(fp.sans));
    const fontBold = await doc.embedFont(readFileSync(fp.bold));

    const page = doc.addPage([595.28, 841.89]);
    const margin = 56;
    let y = page.getHeight() - margin;
    const maxW = page.getWidth() - margin * 2;

    const draw = (text: string, size: number, bold = false) => {
      const f = bold ? fontBold : font;
      page.drawText(text, { x: margin, y, size, font: f, color: rgb(0.1, 0.1, 0.1) });
      y -= size + 8;
    };

    const okulAdi = String(school.name || 'Okul').trim();
    const ogr = body.ogrenci;
    const adSoyad = String(ogr.ad_soyad || '').trim();
    const sinif = String(ogr.sinif || '').trim();
    const no = String(ogr.ogrenci_no || '').trim();
    const today = new Date();
    const tarihTr = `${String(today.getDate()).padStart(2, '0')}.${String(today.getMonth() + 1).padStart(2, '0')}.${today.getFullYear()}`;

    draw(okulAdi, 12, true);
    y -= 4;
    draw('VELİ İZİN DİLEKÇESİ', 14, true);
    y -= 12;
    draw(`Tarih: ${tarihTr}`, 11);
    draw(`Öğrenci: ${adSoyad}`, 11);
    draw(`Sınıf: ${sinif}   Okul No: ${no}`, 11);
    y -= 8;
    draw(
      'Velisi bulunduğum yukarıda kimliği yazılı öğrencimin aşağıda belirtilen tarihlerde okula gelmemesine izin verilmesini arz ederim.',
      11,
    );
    y -= 8;
    draw('İzin günleri:', 11, true);
    for (const s of body.satirlar) {
      const line = `• ${String(s.tarih || '').trim()}${s.tur ? ` — ${String(s.tur).trim()}` : ''}`;
      if (y < margin + 80) break;
      draw(line.slice(0, 90), 10);
    }
    y -= 24;
    draw('Veli adı soyadı: ........................................', 11);
    y -= 20;
    draw('İmza: ........................................', 11);

    const bytes = await doc.save();
    return Buffer.from(bytes);
  }
}
