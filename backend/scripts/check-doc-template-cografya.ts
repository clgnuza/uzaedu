/**
 * Coğrafya şablonunun listede görünüp görünmediğini kontrol eder.
 * Kullanım: cd backend && npx ts-node -r tsconfig-paths/register scripts/check-doc-template-cografya.ts
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { DocumentTemplatesService } from '../src/document-templates/document-templates.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(DocumentTemplatesService);
  try {
    const res = await (service as any).findAll({
      type: 'yillik_plan',
      grade: 9,
      subject_code: 'cografya',
      academic_year: '2024-2025',
      active_only: true,
      page: 1,
      limit: 50,
    });
    console.log('Sorgu (grade=9, cografya, 2024-2025):');
    console.log('  total:', res.total);
    console.log('  items:', res.items?.length ?? 0);
    if (res.items?.length) {
      res.items.forEach((t: any, i: number) => {
        console.log(`  [${i}] id=${t.id} type=${t.type} subject=${t.subjectLabel ?? t.subject_label} fileFormat=${t.fileFormat ?? t.file_format}`);
      });
    } else {
      console.log('  -> Şablon bulunamadı. Veritabanında yillik_plan + cografya var mı kontrol edin.');
    }
  } catch (err) {
    console.error('Hata:', err);
  } finally {
    await app.close();
  }
}

main();
