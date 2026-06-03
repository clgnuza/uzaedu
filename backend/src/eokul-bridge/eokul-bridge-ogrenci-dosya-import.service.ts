import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessagingService } from '../messaging/messaging.service';
import { SchoolClass } from '../classes-subjects/entities/school-class.entity';
import { Student } from '../students/entities/student.entity';
import type { OgrenciDosyaImportDto } from './dto/ogrenci-dosya-import.dto';

@Injectable()
export class EokulBridgeOgrenciDosyaImportService {
  constructor(
    private readonly messaging: MessagingService,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(SchoolClass)
    private readonly classRepo: Repository<SchoolClass>,
  ) {}

  async import(schoolId: string, body: OgrenciDosyaImportDto) {
    const groupId = String(body.group_id || '').trim();
    const rows = Array.isArray(body.rows) ? body.rows : [];

    if (groupId === 'veliBilgileri') {
      const veliRows = rows.map((r) => ({
        sinif_adi: String(r.sinif || r.values?.sinif || '').trim(),
        ogrenci_no: String(r.ogrenci_no || r.values?.ogrenciNo || '').trim(),
        ad_soyad: String(r.ad_soyad || r.values?.adSoyad || '').trim(),
        anne_ad_soyad: String(r.values?.anneAdiSoyadi || '').trim() || undefined,
        anne_telefon: String(r.values?.anneCepTelefonu || '').trim() || undefined,
        baba_ad_soyad: String(r.values?.babaAdiSoyadi || '').trim() || undefined,
        baba_telefon: String(r.values?.babaCepTelefonu || '').trim() || undefined,
      }));
      return this.messaging.importVeliRehberFromEokul(schoolId, veliRows);
    }

    if (groupId === 'ogrenciBilgileri') {
      const classes = await this.classRepo.find({ where: { schoolId } });
      const byName = new Map(
        classes.map((c) => [String(c.name || '').trim().toLocaleLowerCase('tr-TR'), c]),
      );
      let created = 0;
      let updated = 0;
      let skipped = 0;
      for (const r of rows) {
        const sinifKey = String(r.sinif || r.values?.sinif || r.values?.sinifSube || '')
          .trim()
          .toLocaleLowerCase('tr-TR');
        const cls = byName.get(sinifKey);
        if (!cls) {
          skipped++;
          continue;
        }
        const no = String(r.ogrenci_no || r.values?.ogrenciNo || '').trim();
        const adSoyad =
          String(r.ad_soyad || '').trim() ||
          [r.values?.adi, r.values?.soyadi].filter(Boolean).join(' ').trim();
        if (!adSoyad) {
          skipped++;
          continue;
        }
        let st = no
          ? await this.studentRepo.findOne({ where: { schoolId, studentNumber: no } })
          : null;
        if (st) {
          st.name = adSoyad;
          st.classId = cls.id;
          await this.studentRepo.save(st);
          updated++;
        } else {
          st = this.studentRepo.create({
            schoolId,
            classId: cls.id,
            name: adSoyad,
            studentNumber: no || null,
          });
          await this.studentRepo.save(st);
          created++;
        }
      }
      return { ok: true, group_id: groupId, created, updated, skipped, total: rows.length };
    }

    return {
      ok: true,
      group_id: groupId,
      stored: rows.length,
      message:
        'Bu grup için panelde öğrenci kaydı güncellenmedi; veri alındı. Veli/öğrenci bilgisi gruplarında otomatik aktarım vardır.',
    };
  }
}
