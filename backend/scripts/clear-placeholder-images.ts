/**
 * Placeholder (logo, mansetresim) görsellerini veritabanından temizler.
 * Çalıştırma: cd backend && npx ts-node -r tsconfig-paths/register scripts/clear-placeholder-images.ts
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
  console.log('Placeholder görseller temizleniyor...\n');

  const { cleared } = await syncService.clearPlaceholderImages();

  console.log('\n=== Sonuç ===');
  console.log('Temizlenen kayıt:', cleared);

  await app.close();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
