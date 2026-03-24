import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Evrak şablon oluştururken kullanılan katalog verileri.
 * Kaynak: ogretmenevrak.com – tam başlıklar.
 */
export type DocumentCatalogCategory =
  | 'evrak_type'
  | 'sub_type'
  | 'school_type'
  | 'section'
  | 'subject';

@Entity('document_catalog')
@Index(['category', 'parentCode'])
@Index(['category', 'gradeMin', 'gradeMax', 'sectionFilter'])
export class DocumentCatalog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 32 })
  category: DocumentCatalogCategory;

  /** sub_type için: hangi evrak türüne ait (zumre, iyep_plan, bep_plan) */
  @Column({ name: 'parent_code', type: 'varchar', length: 64, nullable: true })
  parentCode: string | null;

  @Column({ type: 'varchar', length: 64 })
  code: string;

  /** ÖğretmenEvrak’tan alınan tam başlık */
  @Column({ type: 'varchar', length: 256 })
  label: string;

  /** Sadece subject için: geçerli olduğu sınıf aralığı */
  @Column({ name: 'grade_min', type: 'int', nullable: true })
  gradeMin: number | null;

  @Column({ name: 'grade_max', type: 'int', nullable: true })
  gradeMax: number | null;

  /** Sadece subject için: ders, secmeli, iho */
  @Column({ name: 'section_filter', type: 'varchar', length: 16, nullable: true })
  sectionFilter: string | null;

  /** BİLSEM subject için: GENEL_YETENEK, RESIM, MUZIK, DIGERLERI */
  @Column({ name: 'ana_grup', type: 'varchar', length: 32, nullable: true })
  anaGrup: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
