import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export const EXAM_DUTY_CATEGORIES = ['meb', 'osym', 'aof', 'ataaof', 'auzef'] as const;
export type ExamDutyCategorySlug = (typeof EXAM_DUTY_CATEGORIES)[number];

export function normalizeExamDutyCategorySlug(v: string | null | undefined): ExamDutyCategorySlug | null {
  if (v == null || String(v).trim() === '') return null;
  const s = String(v).trim().toLowerCase();
  return (EXAM_DUTY_CATEGORIES as readonly string[]).includes(s) ? (s as ExamDutyCategorySlug) : null;
}

export const EXAM_DUTY_CATEGORY_LABELS: Record<ExamDutyCategorySlug, string> = {
  meb: 'MEB',
  osym: 'ÖSYM',
  aof: 'AÖF',
  ataaof: 'ATA-AÖF',
  auzef: 'AUZEF',
};

/** Kategoriye göre resmi başvuru URL'leri – kaynak URL ile karışmasın */
export const EXAM_DUTY_CATEGORY_APPLICATION_URLS: Record<ExamDutyCategorySlug, string> = {
  meb: 'https://mebbis.meb.gov.tr',
  osym: 'https://gis.osym.gov.tr',
  aof: 'https://augis.anadolu.edu.tr',
  ataaof: 'https://augis.ata.edu.tr',
  auzef: 'https://auzefgis.istanbul.edu.tr',
};

export function getApplicationUrlForCategory(categorySlug: string): string {
  return EXAM_DUTY_CATEGORY_APPLICATION_URLS[categorySlug as ExamDutyCategorySlug]
    ?? EXAM_DUTY_CATEGORY_APPLICATION_URLS.meb;
}

/** Sync'ten gelen başlık: sadece "ÖSYM Sınav Görevi" – uzun kaynak başlığı eklenmez. */
export function formatExamDutySyncTitle(categorySlug: string, _originalTitle?: string | null): string {
  const label = EXAM_DUTY_CATEGORY_LABELS[categorySlug as ExamDutyCategorySlug] ?? categorySlug.toUpperCase();
  return `${label} Sınav Görevi`;
}

export type ExamDutyStatus = 'draft' | 'published';

/** GPT tarih doğrulama sonucu: validated = uyumlu, corrected = GPT önerisiyle düzeltildi, needs_review = inceleme gerekli */
export type DateValidationStatus = 'validated' | 'corrected' | 'needs_review';

@Entity('exam_duties')
export class ExamDuty {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 512 })
  title: string;

  @Column({ name: 'category_slug', type: 'varchar', length: 32 })
  categorySlug: string;

  @Column({ type: 'text', nullable: true })
  summary: string | null;

  @Column({ type: 'text', nullable: true })
  body: string | null;

  @Column({ name: 'source_url', type: 'varchar', length: 1024, nullable: true })
  sourceUrl: string | null;

  @Column({ name: 'application_url', type: 'varchar', length: 1024, nullable: true })
  applicationUrl: string | null;

  @Column({ name: 'source_key', type: 'varchar', length: 64, nullable: true })
  sourceKey: string | null;

  @Column({ name: 'external_id', type: 'varchar', length: 256, nullable: true })
  externalId: string | null;

  /** Sync: kaynak sitedeki ham başlık (çapraz kaynak mükerrer kontrolü) */
  @Column({ name: 'source_list_headline', type: 'varchar', length: 512, nullable: true })
  sourceListHeadline: string | null;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @Column({ name: 'application_start', type: 'timestamptz', nullable: true })
  applicationStart: Date | null;

  @Column({ name: 'application_end', type: 'timestamptz', nullable: true })
  applicationEnd: Date | null;

  @Column({ name: 'application_approval_end', type: 'timestamptz', nullable: true })
  applicationApprovalEnd: Date | null;

  @Column({ name: 'result_date', type: 'timestamptz', nullable: true })
  resultDate: Date | null;

  @Column({ name: 'exam_date', type: 'timestamptz', nullable: true })
  examDate: Date | null;

  @Column({ name: 'exam_date_end', type: 'timestamptz', nullable: true })
  examDateEnd: Date | null;

  @Column({ type: 'varchar', length: 32, default: 'draft' })
  status: ExamDutyStatus;

  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  /** GPT tarih doğrulama: validated / corrected / needs_review; null = doğrulama yapılmadı */
  @Column({ name: 'date_validation_status', type: 'varchar', length: 32, nullable: true })
  dateValidationStatus: DateValidationStatus | null;

  /** Doğrulama uyarıları (Türkçe, noktalı virgülle ayrılmış) */
  @Column({ name: 'date_validation_issues', type: 'text', nullable: true })
  dateValidationIssues: string | null;

  /** Scrape sync: slider | list | recheck */
  @Column({ name: 'source_list_section', type: 'varchar', length: 16, nullable: true })
  sourceListSection: string | null;

  /** Bölüm içi 0 tabanlı sıra (slayt: 0 = en üstteki öğe) */
  @Column({ name: 'source_section_order', type: 'int', nullable: true })
  sourceSectionOrder: number | null;

  /** Sync anında slayt havuzundaki toplam öğe (örn. 15) */
  @Column({ name: 'source_slider_pool_size', type: 'int', nullable: true })
  sourceSliderPoolSize: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_user_id' })
  createdBy: User | null;
}
