/**
 * Sınav görevi senkronizasyonu tetikleyici.
 * RSS ve scrape kaynaklarından sınav görevi duyuruları çeker.
 * Çalıştırma: cd backend && npm run run-exam-duty-sync
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ExamDutySyncService } from '../src/exam-duties/exam-duty-sync.service';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const syncService = app.get(ExamDutySyncService);
  console.log('Sınav görevi senkronizasyonu başlatılıyor...\n');

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
  process.exit(result.ok ? 0 : 1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
