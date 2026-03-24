/**
 * Örnek yıllık plan dosyasını R2'ye yükler.
 * R2 ayarları Superadmin Ayarlar → Depolama (R2) bölümünden okunur.
 *
 * Kullanım: cd backend && npm run upload-plan-r2
 *
 * Ön koşul: Veritabanı çalışıyor olmalı (docker start ogretmenpro-db),
 * backend/.env içinde DB_* ve R2 ayarları (DB'de) dolu olmalı.
 */

import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { UploadService } from '../src/upload/upload.service';
import * as fs from 'fs';
import * as path from 'path';

const TEMPLATE_FILE = 'ornek-yillik-plan-cografya.xlsx';
const R2_KEY = `document_template/${TEMPLATE_FILE}`;
const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

async function main() {
  const templatesDir = path.join(__dirname, '..', 'templates');
  const filePath = path.join(templatesDir, TEMPLATE_FILE);

  if (!fs.existsSync(filePath)) {
    console.error(`Dosya bulunamadı: ${filePath}`);
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const upload = app.get(UploadService);
    const buffer = fs.readFileSync(filePath);
    await upload.uploadBuffer(R2_KEY, buffer, MIME);
    console.log('Yükleme tamamlandı.');
    console.log('R2 key:', R2_KEY);
    console.log('Evrak şablonu eklerken bu key\'i "Dosya" alanına yapıştırın.');
  } catch (err) {
    console.error('Hata:', err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    await app.close();
  }
}

main();
