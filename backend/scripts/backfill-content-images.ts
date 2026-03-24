/**
 * image_url boş içerikleri haber sayfasından og:image ile doldurur.
 * Çalıştırma: cd backend && npm run backfill-content-images
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ContentSyncService } from '../src/content/content-sync.service';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const syncService = app.get(ContentSyncService);
  const limit = parseInt(process.env.BACKFILL_LIMIT ?? '200', 10);
  console.log(`Görsel backfill başlatılıyor (limit: ${limit})...\n`);

  const { updated, failed } = await syncService.backfillMissingImages(limit);

  console.log('\n=== Sonuç ===');
  console.log('Güncellenen:', updated);
  console.log('Görsel bulunamayan:', failed);

  await app.close();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
