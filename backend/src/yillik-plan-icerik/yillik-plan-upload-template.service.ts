import { BadRequestException, Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

/** Sabit şablon — güncelleme: masaüstü dosyasını backend/templates/ altına kopyalayın (değiştirmeyin). */
const BASE_TEMPLATE_FILE = 'yiillik-plan-sablon-2.xlsx';

@Injectable()
export class YillikPlanUploadTemplateService {
  private resolveBasePath(): string {
    const candidates = [
      path.join(process.cwd(), 'templates', BASE_TEMPLATE_FILE),
      path.join(__dirname, '..', '..', 'templates', BASE_TEMPLATE_FILE),
      path.join(__dirname, '..', 'templates', BASE_TEMPLATE_FILE),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    throw new BadRequestException(
      `Sabit şablon bulunamadı (${BASE_TEMPLATE_FILE}). backend/templates içinde olmalı.`,
    );
  }

  /** Dosyayı olduğu gibi döndürür; takvim/hafta üretimi yapılmaz. */
  getStaticTemplate(): Buffer {
    return fs.readFileSync(this.resolveBasePath());
  }
}
