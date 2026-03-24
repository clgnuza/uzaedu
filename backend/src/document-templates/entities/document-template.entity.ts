import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Evrak şablon türleri – katalog (document_catalog) tablosundan gelir */
/** Zümre: sene_basi, sene_sonu. BEP: dosya, plan_yeni, plan_eski, kaba_form. İYEP: turkce, matematik */
@Entity('document_templates')
export class DocumentTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64 })
  type: string;

  @Column({ name: 'sub_type', type: 'varchar', length: 64, nullable: true })
  subType: string | null;

  /** Zümre için: ilkokul, ortaokul, lise, okul_oncesi, mesem, ozel_egitim */
  @Column({ name: 'school_type', type: 'varchar', length: 32, nullable: true })
  schoolType: string | null;

  /** Planlar için: 1-12 */
  @Column({ type: 'int', nullable: true })
  grade: number | null;

  /** Planlar için: ders, secmeli, iho */
  @Column({ type: 'varchar', length: 16, nullable: true })
  section: string | null;

  @Column({ name: 'subject_code', type: 'varchar', length: 64, nullable: true })
  subjectCode: string | null;

  @Column({ name: 'subject_label', type: 'varchar', length: 128, nullable: true })
  subjectLabel: string | null;

  @Column({ name: 'curriculum_model', type: 'varchar', length: 32, nullable: true })
  curriculumModel: string | null;

  @Column({ name: 'academic_year', type: 'varchar', length: 16, nullable: true })
  academicYear: string | null;

  @Column({ type: 'varchar', length: 32 })
  version: string;

  /** R2 key (document_template/xxx) veya http(s) URL veya local:dosya.adı */
  @Column({ name: 'file_url', type: 'varchar', length: 512 })
  fileUrl: string;

  /** R2 kullanılamazsa yerel fallback; örn. local:ornek-yillik-plan-cografya.xlsx */
  @Column({ name: 'file_url_local', type: 'varchar', length: 512, nullable: true })
  fileUrlLocal: string | null;

  @Column({ name: 'file_format', type: 'varchar', length: 16, default: 'docx' })
  fileFormat: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  /** Merge gerektiriyor mu? true ise POST /documents/generate kullanılır */
  @Column({ name: 'requires_merge', type: 'boolean', default: false })
  requiresMerge: boolean;

  /** Form alanları JSON: [{ key, label, type, required }] */
  @Column({ name: 'form_schema', type: 'jsonb', nullable: true })
  formSchema: Array<{ key: string; label: string; type: string; required?: boolean }> | null;

  @Column({ name: 'sort_order', type: 'int', nullable: true })
  sortOrder: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
