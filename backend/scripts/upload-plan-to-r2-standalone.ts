/**
 * Örnek yıllık plan dosyasını R2'ye yükler (DB bağımsız).
 * R2 bilgileri .env'den okunur:
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
 *
 * Bu değerler Superadmin Ayarlar'dan alınabilir veya .env'e eklenebilir.
 *
 * Kullanım: cd backend && npm run upload-plan-r2-standalone
 */

import 'dotenv/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';

const TEMPLATE_FILE = 'ornek-yillik-plan-cografya.xlsx';
const R2_KEY = `document_template/${TEMPLATE_FILE}`;
const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

async function main() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    console.error(
      'R2 ayarları eksik. .env dosyasına şunları ekleyin:\n' +
        '  R2_ACCOUNT_ID=...\n' +
        '  R2_ACCESS_KEY_ID=...\n' +
        '  R2_SECRET_ACCESS_KEY=...\n' +
        '  R2_BUCKET=...\n\n' +
        'Bu değerleri Superadmin Ayarlar → Depolama (R2) bölümünden kopyalayabilirsiniz.',
    );
    process.exit(1);
  }

  const templatesDir = path.join(__dirname, '..', 'templates');
  const filePath = path.join(templatesDir, TEMPLATE_FILE);

  if (!fs.existsSync(filePath)) {
    console.error(`Dosya bulunamadı: ${filePath}`);
    process.exit(1);
  }

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  const buffer = fs.readFileSync(filePath);

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: R2_KEY,
        Body: buffer,
        ContentType: MIME,
      }),
    );
    console.log('Yükleme tamamlandı.');
    console.log('R2 key:', R2_KEY);
    console.log('Evrak şablonu eklerken bu key\'i "Dosya" alanına yapıştırın.');
  } catch (err) {
    console.error('Hata:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
