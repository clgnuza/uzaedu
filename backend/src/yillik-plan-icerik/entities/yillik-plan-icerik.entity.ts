import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Yıllık plan içeriği – ders/sınıf/yıl bazlı konu, kazanım, ders saati.
 * Superadmin CRUD. Kazanım modülü için kaynak; evrak merge'de plan satırları için kullanılır.
 */
@Entity('yillik_plan_icerik')
export class YillikPlanIcerik {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** MEB ders kodu (cografya, matematik...) */
  @Column({ name: 'subject_code', type: 'varchar', length: 64 })
  subjectCode: string;

  /** Ders etiketi (Coğrafya, Matematik) */
  @Column({ name: 'subject_label', type: 'varchar', length: 128 })
  subjectLabel: string;

  /** Sınıf (1-12) – MEB için zorunlu; Bilsem için null (ana_grup/alt_grup kullanılır) */
  @Column({ type: 'int', nullable: true })
  grade: number | null;

  /** Bilsem ana grup – Program aşaması: UYUM, DESTEK-1, DESTEK-2, BYF-1, BYF-2, ÖYG, PROJE */
  @Column({ name: 'ana_grup', type: 'varchar', length: 64, nullable: true })
  anaGrup: string | null;

  /** Bilsem alt grup – opsiyonel (A, B, Grup 1 vb.) */
  @Column({ name: 'alt_grup', type: 'varchar', length: 64, nullable: true })
  altGrup: string | null;

  /** Bölüm – ders, secmeli, iho (5-8 için) */
  @Column({ type: 'varchar', length: 16, nullable: true })
  section: string | null;

  /** Öğretim yılı (2024-2025) */
  @Column({ name: 'academic_year', type: 'varchar', length: 16 })
  academicYear: string;

  /** Hafta sırası (work_calendar ile eşleşir) */
  @Column({ name: 'week_order', type: 'int' })
  weekOrder: number;

  /** Ünite adı */
  @Column({ type: 'varchar', length: 256, nullable: true })
  unite: string | null;

  /** Konu başlığı */
  @Column({ type: 'varchar', length: 512, nullable: true })
  konu: string | null;

  /** Kazanımlar / Öğrenme çıktıları – COĞ.9.1.1. formatında. Kazanım modülü için kaynak. */
  @Column({ type: 'text', nullable: true })
  kazanimlar: string | null;

  /** O hafta ders saati */
  @Column({ name: 'ders_saati', type: 'int', default: 0 })
  dersSaati: number;

  /** Belirli gün ve haftalar – örn. "15 Temmuz Demokrasi ve Millî Birlik Günü" */
  @Column({ name: 'belirli_gun_haftalar', type: 'varchar', length: 256, nullable: true })
  belirliGunHaftalar: string | null;

  /** Süreç bileşenleri – DB1.1, SDB2.2 vb. */
  @Column({ name: 'surec_bilesenleri', type: 'text', nullable: true })
  surecBilesenleri: string | null;

  /** Ölçme ve değerlendirme */
  @Column({ name: 'olcme_degerlendirme', type: 'text', nullable: true })
  olcmeDegerlendirme: string | null;

  /** Sosyal - duygusal öğrenme becerileri */
  @Column({ name: 'sosyal_duygusal', type: 'text', nullable: true })
  sosyalDuygusal: string | null;

  /** Değerler */
  @Column({ name: 'degerler', type: 'text', nullable: true })
  degerler: string | null;

  /** Okuryazarlık becerileri */
  @Column({ name: 'okuryazarlik_becerileri', type: 'text', nullable: true })
  okuryazarlikBecerileri: string | null;

  /** Farklılaştırma */
  @Column({ name: 'zenginlestirme', type: 'text', nullable: true })
  zenginlestirme: string | null;

  /** Okul temelli planlama */
  @Column({ name: 'okul_temelli_planlama', type: 'text', nullable: true })
  okulTemelliPlanlama: string | null;

  @Column({ name: 'sort_order', type: 'int', nullable: true })
  sortOrder: number | null;

  /** null = MEB / kazanım; bilsem = Bilsem yıllık plan içerikleri */
  @Column({ name: 'curriculum_model', type: 'varchar', length: 32, nullable: true })
  curriculumModel: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
