import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/**
 * Superadmin tarafından yönetilen değerlendirme kriterleri.
 * Örn: Lokasyonun Sosyo-Ekonomik Durumu, Ulaşım, İdarenin Öğretmen Yaklaşımı vb.
 */
@Entity('school_review_criteria')
export class SchoolReviewCriteria {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Slug: URL ve JSON key için (örn. sosyo_ekonomik, ulasim) */
  @Column({ type: 'varchar', length: 64, unique: true })
  slug: string;

  /** Görünen başlık */
  @Column({ type: 'varchar', length: 255 })
  label: string;

  /** Açıklama / ipucu (örn. "1 = en pahalı") */
  @Column({ type: 'varchar', length: 255, nullable: true })
  hint: string | null;

  /** Sıralama (küçük önce) */
  @Column({ type: 'int', default: 0 })
  sort_order: number;

  /** Min puan (varsayılan 1) */
  @Column({ type: 'int', default: 1 })
  min_score: number;

  /** Max puan (varsayılan 10) */
  @Column({ type: 'int', default: 10 })
  max_score: number;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;
}
