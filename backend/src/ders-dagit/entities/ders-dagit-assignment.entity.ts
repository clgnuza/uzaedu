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
import { DersDagitSubject } from './ders-dagit-subject.entity';
import { DersDagitGroup } from './ders-dagit-group.entity';

@Entity('ders_dagit_assignment')
export class DersDagitAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'studio_id', type: 'uuid' })
  studio_id: string;

  @Column({ name: 'subject_id', type: 'uuid', nullable: true })
  subject_id: string | null;

  @Column({ name: 'subject_name', type: 'varchar', length: 128 })
  subject_name: string;

  @Column({ name: 'group_id', type: 'uuid', nullable: true })
  group_id: string | null;

  @Column({ name: 'class_sections', type: 'jsonb', default: [] })
  class_sections: string[];

  @Column({ name: 'weekly_hours', type: 'int', default: 1 })
  weekly_hours: number;

  @Column({ type: 'boolean', default: false })
  biweekly: boolean;

  @Column({ name: 'min_days_per_week', type: 'int', nullable: true })
  min_days_per_week: number | null;

  @Column({ name: 'max_days_per_week', type: 'int', nullable: true })
  max_days_per_week: number | null;

  @Column({ name: 'max_per_day', type: 'int', nullable: true })
  max_per_day: number | null;

  @Column({ type: 'varchar', length: 16, default: 'normal' })
  priority: string;

  @Column({ name: 'place_first', type: 'boolean', default: false })
  place_first: boolean;

  @Column({ name: 'room_ids', type: 'jsonb', default: [] })
  room_ids: string[];

  @Column({ name: 'unavailable_periods', type: 'jsonb', default: [] })
  unavailable_periods: unknown[];

  @Column({ name: 'fixed_slots', type: 'jsonb', default: [] })
  fixed_slots: unknown[];

  @Column({ type: 'jsonb', default: {} })
  options: Record<string, unknown>;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sort_order: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @ManyToOne(() => DersDagitStudio, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'studio_id' })
  studio: DersDagitStudio;

  @ManyToOne(() => DersDagitSubject, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'subject_id' })
  subject: DersDagitSubject | null;

  @ManyToOne(() => DersDagitGroup, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'group_id' })
  group: DersDagitGroup | null;
}
