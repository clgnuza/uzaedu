/**
 * Sync'i iki kez çalıştırır; ikinci çalıştırmada "yeni eklenen" sayısının 0 (veya çok düşük) olması gerekir.
 * Aynı URL'ler tekrar eklenmiyorsa ikinci run'da created = 0 olur.
 * Çalıştırma: cd backend && npx ts-node -r tsconfig-paths/register scripts/test-exam-duty-sync-twice.ts
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

  console.log('=== 1. Sync çalıştırılıyor... ===\n');
  const result1 = await syncService.runSync();
  console.log('1. Sonuç:', result1.message);
  console.log('1. Toplam yeni (created):', result1.total_created);
  console.log('1. Kaynak bazında:', result1.results.map((r) => `${r.source_key}=+${r.created}`).join(', '));

  console.log('\n=== 2. Sync tekrar çalıştırılıyor (aynı içerik tekrar eklenmemeli)... ===\n');
  const result2 = await syncService.runSync();
  console.log('2. Sonuç:', result2.message);
  console.log('2. Toplam yeni (created):', result2.total_created);
  console.log('2. Kaynak bazında:', result2.results.map((r) => `${r.source_key}=+${r.created}`).join(', '));

  const pass = result2.total_created === 0;
  console.log('\n=== Test:', pass ? 'GEÇTİ (ikinci sync 0 yeni ekledi)' : 'KONTROL EDİN (ikinci sync ' + result2.total_created + ' yeni ekledi)');
  if (!pass) {
    console.log('Beklenen: İkinci çalıştırmada aynı URL\'ler "Zaten mevcut" atlanmalı, created=0.');
  }

  await app.close();
  process.exit(pass ? 0 : 1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
