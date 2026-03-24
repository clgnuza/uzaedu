/**
 * Anadolu Lisesi Coğrafya taslak yıllık plan şablonunu ekler (yoksa).
 * Backend yeniden başlatmadan şablon eklemek için.
 *
 * Kullanım: cd backend && npm run seed-doc-cografya
 */

import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentTemplate } from '../src/document-templates/entities/document-template.entity';

const FILE_URL =
  'COĞRAFYA DERSİ YILLIK PLANLARI/ANADOLU LİSESİ COĞRAFYA DERSİ TASLAK YILLIK PLANLARI/ANADOLU LİSESİ COĞRAFYA DERSİ TASLAK YILLIK PLANLARI.xlsx';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const repo = app.get<Repository<DocumentTemplate>>(
      getRepositoryToken(DocumentTemplate),
    );
    const existing = await repo.findOne({
      where: {
        type: 'yillik_plan',
        schoolType: 'lise',
        subjectCode: 'cografya',
        fileUrl: FILE_URL,
      },
    });
    if (existing) {
      console.log('Şablon zaten mevcut:', existing.id);
      return;
    }
    const t = repo.create({
      type: 'yillik_plan',
      subType: null,
      schoolType: 'lise',
      grade: null,
      section: 'ders',
      subjectCode: 'cografya',
      subjectLabel: 'Coğrafya',
      curriculumModel: null,
      academicYear: null,
      version: '1',
      fileUrl: FILE_URL,
      fileFormat: 'xlsx',
      isActive: true,
      requiresMerge: false,
      formSchema: null,
      sortOrder: 10,
    });
    await repo.save(t);
    console.log('Şablon eklendi:', t.id);
    console.log('Admin panelde Evrak Şablonları sayfasını yenileyin.');
  } catch (err) {
    console.error('Hata:', err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    await app.close();
  }
}

main();
