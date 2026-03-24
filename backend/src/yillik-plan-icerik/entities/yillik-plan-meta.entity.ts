import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Yıllık plan meta – ders/sınıf/yıl bazlı tablo altı not.
 * Hafta bağımsız; evrak çıktısında tablonun altında küçük yazı olarak görünür.
 */
@Entity('yillik_plan_meta')
export class YillikPlanMeta {
  /** subject_code|grade|academic_year – tekil anahtar */
  @PrimaryColumn({ name: 'plan_key', type: 'varchar', length: 128 })
  planKey: string;

  /** Tablo altı not – yıldızlı açıklamalar (Okul temelli planlama* vb.) */
  @Column({ name: 'tablo_alti_not', type: 'text', nullable: true })
  tabloAltiNot: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

export function buildPlanKey(
  subjectCode: string,
  gradeOrAna: number | string,
  academicYear: string,
  curriculumModel?: string | null,
  altGrup?: string | null,
): string {
  const cm = curriculumModel?.trim();
  const base =
    cm === 'bilsem'
      ? `${String(subjectCode || '').trim()}|${String(gradeOrAna || '').trim()}|${String(altGrup ?? '').trim()}|${String(academicYear || '').trim()}`
      : `${String(subjectCode || '').trim()}|${gradeOrAna}|${String(academicYear || '').trim()}`;
  if (cm) return `${cm}|${base}`;
  return base;
}
