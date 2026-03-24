import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentGeneration } from './entities/document-generation.entity';
import { DocumentTemplate } from './entities/document-template.entity';
import { User } from '../users/entities/user.entity';

export type GenerationListItem = {
  id: string;
  displayLabel: string;
  grade: string | null;
  section: string | null;
  subjectCode: string | null;
  subjectLabel: string | null;
  academicYear: string | null;
  fileFormat: string;
  createdAt: string;
  /** Şablon müfredatı — BİLSEM arşiv kartı için */
  curriculumModel: string | null;
};

@Injectable()
export class DocumentGenerationService {
  constructor(
    @InjectRepository(DocumentGeneration)
    private readonly repo: Repository<DocumentGeneration>,
  ) {}

  /** Üretim sonrası arşive kaydet */
  async save(
    user: User,
    template: DocumentTemplate,
    formData: Record<string, string | number>,
    displayLabel: string,
  ): Promise<DocumentGeneration> {
    const grade = this.getFormStr(formData, 'grade', 'sinif');
    const section = this.getFormStr(formData, 'section');
    const subjectCode = this.getFormStr(formData, 'subject_code', 'ders_kodu', 'dersKodu');
    const subjectLabel = this.getFormStr(formData, 'subject_label', 'ders_adi', 'dersAdi');
    const academicYear = this.getFormStr(formData, 'academic_year', 'ogretim_yili');
    const format = template.fileFormat ?? 'docx';

    const t = (s: string, n: number) => (s.length <= n ? s : s.slice(0, n));
    const subjLab = subjectLabel || template.subjectLabel || '';
    const gen = this.repo.create({
      userId: user.id,
      templateId: template.id,
      formData,
      displayLabel: t(displayLabel, 256),
      grade: grade ? t(grade, 8) : null,
      section: section ? t(section, 32) : null,
      subjectCode: subjectCode ? t(subjectCode, 64) : null,
      subjectLabel: subjLab ? t(subjLab, 128) : null,
      academicYear: academicYear ? t(academicYear, 16) : null,
      fileFormat: format,
    });
    return this.repo.save(gen);
  }

  private getFormStr(formData: Record<string, string | number>, ...keys: string[]): string {
    for (const k of keys) {
      const v = formData[k];
      if (v != null && typeof v === 'string' && v.trim()) return v.trim();
      if (v != null && typeof v === 'number') return String(v);
    }
    return '';
  }

  /** Kullanıcının son üretimlerini listele */
  async findAllByUser(
    userId: string,
    limit = 20,
  ): Promise<GenerationListItem[]> {
    const items = await this.repo.find({
      where: { userId },
      relations: ['template'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return items.map((i) => ({
      id: i.id,
      displayLabel: i.displayLabel,
      grade: i.grade,
      section: i.section,
      subjectCode: i.subjectCode,
      subjectLabel: i.subjectLabel,
      academicYear: i.academicYear,
      fileFormat: i.fileFormat,
      createdAt: i.createdAt.toISOString(),
      curriculumModel: i.template?.curriculumModel?.trim() || null,
    }));
  }

  /** Kayıt bul (kullanıcı scope) */
  async findOneForUser(id: string, userId: string): Promise<DocumentGeneration> {
    const gen = await this.repo.findOne({
      where: { id, userId },
      relations: ['template'],
    });
    if (!gen) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Üretim kaydı bulunamadı.',
      });
    }
    return gen;
  }

  async deleteForUser(id: string, userId: string): Promise<void> {
    const result = await this.repo.delete({ id, userId });
    if (!result.affected) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Üretim kaydı bulunamadı.',
      });
    }
  }
}
