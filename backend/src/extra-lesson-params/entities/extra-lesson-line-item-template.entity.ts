import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

/**
 * Ek ders kalem şablonu – gösterge tablosu.
 * Superadmin tarafından görüntülenir ve düzenlenir.
 * Formül: Tutar = ROUND(katsayı × gösterge, 2)
 */
@Entity('extra_lesson_line_item_templates')
export class ExtraLessonLineItemTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Kalem anahtarı (gunduz, gece, nobet, takviye_gunduz vb.) */
  @Column({ type: 'varchar', length: 64, unique: true })
  key: string;

  /** Görünen etiket */
  @Column({ type: 'varchar', length: 128 })
  label: string;

  /** hourly | fixed */
  @Column({ type: 'varchar', length: 16, default: 'hourly' })
  type: 'hourly' | 'fixed';

  /** Gösterge gündüz (140, 175, 280 vb.) */
  @Column({ type: 'decimal', precision: 8, scale: 2 })
  indicator_day: number;

  /** Gösterge gece (gunduz/takviye_gunduz gibi çift tarifeli kalemler için; null = tek tarife) */
  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  indicator_night: number | null;

  @Column({ type: 'int', default: 0 })
  sort_order: number;
}
