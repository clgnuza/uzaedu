import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Çalışma takvimi – öğretim yılına göre hafta bazlı takvim.
 * Superadmin CRUD. Yıllık plan merge'de hafta tarihleri için kullanılır.
 */
@Entity('work_calendar')
export class WorkCalendar {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Öğretim yılı (2024-2025, 2025-2026) */
  @Column({ name: 'academic_year', type: 'varchar', length: 16 })
  academicYear: string;

  /** Hafta sırası (1-36) */
  @Column({ name: 'week_order', type: 'int' })
  weekOrder: number;

  /** Hafta başlangıç tarihi (Pazartesi) */
  @Column({ name: 'week_start', type: 'date' })
  weekStart: string;

  /** Hafta bitiş tarihi (Cuma) */
  @Column({ name: 'week_end', type: 'date' })
  weekEnd: string;

  /** Ay (EYLÜL, EKİM, KASIM...) */
  @Column({ type: 'varchar', length: 32 })
  ay: string;

  /** Hafta etiketi – örn. "1. Hafta: 8-12 Eylül" */
  @Column({ name: 'hafta_label', type: 'varchar', length: 64, nullable: true })
  haftaLabel: string | null;

  /** Tatil haftası mı? */
  @Column({ name: 'is_tatil', type: 'boolean', default: false })
  isTatil: boolean;

  /** Tatil etiketi – örn. "1. DÖNEM ARA TATİLİ: 10-14 Kasım" */
  @Column({ name: 'tatil_label', type: 'varchar', length: 128, nullable: true })
  tatilLabel: string | null;

  /** Sınav tarihi/etiket (isteğe bağlı) – örn. "1. Dönem 1. Sınav: 15 Kasım" */
  @Column({ name: 'sinav_etiketleri', type: 'varchar', length: 256, nullable: true })
  sinavEtiketleri: string | null;

  @Column({ name: 'sort_order', type: 'int', nullable: true })
  sortOrder: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
