import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * Yarıyıl bazlı ek ders parametre seti. Superadmin tarafından yönetilir.
 * Tüm birim ücretler: Brüt = Katsayı × Gösterge × Çarpan (resmi formül).
 * Superadmin tarafından yönetilir; teacher hesaplama için kullanır.
 */
@Entity('extra_lesson_params')
export class ExtraLessonParams {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Dönem kodu: 2026-1 (Oca-Haz), 2026-2 (Tem-Ara) */
  @Column({ type: 'varchar', length: 32, unique: true })
  semester_code: string;

  /** Görünen dönem adı: "2026 Ocak-Haziran (%18,6)" */
  @Column({ type: 'varchar', length: 128 })
  title: string;

  /**
   * Aylık katsayı (Mali ve Sosyal Haklar Genelgesi). 2026 Oca-Haz: 1,387871.
   * Birim ücret = katsayı × gösterge × çarpan.
   */
  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  monthly_coefficient: string | null;

  /** Gündüz göstergesi (Bakanlar Kurulu). Sabit 140. */
  @Column({ type: 'int', default: 140 })
  indicator_day: number;

  /** Gece göstergesi (Bakanlar Kurulu). Sabit 150. */
  @Column({ type: 'int', default: 150 })
  indicator_night: number;

  /** Kalemler: indicator+multiplier ile formülden hesaplanır veya unit_price ile override. */
  @Column({ type: 'jsonb', default: [] })
  line_items: ExtraLessonLineItem[];

  /** Vergi dilimleri: [{ max_matrah, rate_percent }] — GV Tarife (Tebliğ 332). */
  @Column({ type: 'jsonb', default: [] })
  tax_brackets: TaxBracket[];

  /** GV istisna max (TL) — maaştan sonra ek ders için kalan. Resmi tebliğ ile. */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 4211.33 })
  gv_exemption_max: string;

  /** DV istisna matrah max (TL) = Brüt asgari ücret. 2026: 33.030. */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 33030 })
  dv_exemption_max: string;

  /** Damga vergisi oranı (%) */
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 7.59 })
  stamp_duty_rate: string;

  /** Merkezi sınav görevi rolleri ve sabit ücretleri */
  @Column({ type: 'jsonb', nullable: true })
  central_exam_roles: CentralExamRole[] | null;

  /** Öğrenim durumuna göre birim ücretler: [{ key, label, unit_day, unit_night }] */
  @Column({ type: 'jsonb', nullable: true })
  education_levels: EducationLevel[] | null;

  /** Sözleşmeli/Ücretli: SGK+İşsizlik işçi payı (%, 5510). Örn: 14 = %14. Kadrolu: kesinti yok. */
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 14, nullable: true })
  sgk_employee_rate: string | null;

  /** Ücretli öğretmen birim ücret oranı (kadroluya göre). 1 = kadrolu ile aynı; 0.725 = MEB %72,5. */
  @Column({ type: 'decimal', precision: 6, scale: 4, default: 1, nullable: true })
  ucretli_unit_scale: string | null;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'date', nullable: true })
  valid_from: Date | null;

  @Column({ type: 'date', nullable: true })
  valid_to: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

export type ExtraLessonLineItem = {
  key: string;
  label: string;
  type: 'hourly' | 'fixed';
  /** Gösterge (140 gündüz, 150 gece). Formül: katsayı×gösterge×multiplier. */
  indicator?: number;
  /** Şablondan: katsayı ile çarpılmadan önceki gündüz gösterge (EDUHEP: brüt = ROUND(saat×katsayı×gösterge×ölçek,2)). */
  gosterge_day?: number;
  /** Şablondan gece gösterge (ikili satırlarda). */
  gosterge_night?: number;
  /** Kalem çarpanı: 1 (normal), 1.25 (özel eğitim), 2 (DYK). */
  multiplier?: number;
  /** unit_price yoksa indicator×multiplier ile hesaplanır. Override için. */
  unit_price_day?: number;
  unit_price_night?: number;
  unit_price?: number;
  /** Sabit (merkezi sınav): TL tutar */
  fixed_amount?: number;
  sort_order?: number;
};

export type TaxBracket = {
  max_matrah: number;
  rate_percent: number;
};

export type CentralExamRole = {
  key: string;
  label: string;
  /** Sabit tutar (TL). Bina Sınav Sorumlusu gibi bordroda olmayan roller için. */
  fixed_amount?: number;
  /** MEB bordro gösterge. Varsa: Tutar = ROUND(katsayı × indicator, 2). Öncelik indicator'da. */
  indicator?: number;
};

export type EducationLevel = {
  key: string;
  label: string;
  unit_day: number;
  unit_night: number;
};
