/**
 * İçerik senkronizasyonu tetikleyici.
 * RSS ve scrape kaynaklarından içerik çeker.
 * Çalıştırma: cd backend && npm run run-content-sync
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
  console.log('İçerik senkronizasyonu başlatılıyor...\n');

  const result = await syncService.runSync();

  console.log('\n=== Sonuç ===');
  console.log('OK:', result.ok);
  console.log('Mesaj:', result.message);
  console.log('Toplam yeni:', result.total_created);
  console.log('\nKaynak sonuçları:');
  for (const r of result.results) {
    const err = r.error ? ` [HATA: ${r.error}]` : '';
    console.log(`  - ${r.source_key} (${r.source_label}): +${r.created} eklenen, ${r.skipped} atlanan${err}`);
  }

  await app.close();
  process.exit(result.ok || result.total_created > 0 ? 0 : 1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
