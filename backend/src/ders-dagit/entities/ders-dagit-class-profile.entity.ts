import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { DersDagitStudio } from './ders-dagit-studio.entity';

@Entity('ders_dagit_class_profile')
export class DersDagitClassProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'studio_id', type: 'uuid' })
  studio_id: string;

  @Column({ type: 'varchar', length: 128 })
  name: string;

  @Column({ name: 'class_sections', type: 'jsonb', default: [] })
  class_sections: string[];

  @Column({ name: 'start_time', type: 'varchar', length: 8, nullable: true })
  start_time: string | null;

  @Column({ name: 'end_time', type: 'varchar', length: 8, nullable: true })
  end_time: string | null;

  @Column({ name: 'latest_start_time', type: 'varchar', length: 8, nullable: true })
  latest_start_time: string | null;

  @Column({ name: 'min_lessons_per_day', type: 'int', nullable: true })
  min_lessons_per_day: number | null;

  @Column({ name: 'max_lessons_per_day', type: 'int', default: 8 })
  max_lessons_per_day: number;

  @Column({ name: 'min_weekly_lessons', type: 'int', nullable: true })
  min_weekly_lessons: number | null;

  @Column({ name: 'max_weekly_lessons', type: 'int', nullable: true })
  max_weekly_lessons: number | null;

  @Column({ name: 'education_shift', type: 'varchar', length: 16, nullable: true })
  education_shift: string | null;

  /** Bu profile bağlı tüm şubelerde staj/beceri günü (haftalık gün no 1–7) */
  @Column({ name: 'internship_days', type: 'jsonb', default: [] })
  internship_days: number[];

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sort_order: number;

  /** Boş veya null → stüdyo varsayılan kuralları */
  @Column({ type: 'jsonb', nullable: true })
  rules: Record<string, { active: boolean; weight?: number; params?: Record<string, unknown> }> | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @ManyToOne(() => DersDagitStudio, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'studio_id' })
  studio: DersDagitStudio;
}
