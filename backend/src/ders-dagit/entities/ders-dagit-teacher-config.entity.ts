import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { DersDagitStudio } from './ders-dagit-studio.entity';
import { User } from '../../users/entities/user.entity';

@Entity('ders_dagit_teacher_config')
export class DersDagitTeacherConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'studio_id', type: 'uuid' })
  studio_id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  user_id: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  branch: string | null;

  @Column({ name: 'mandatory_weekly_hours', type: 'int', nullable: true })
  mandatory_weekly_hours: number | null;

  @Column({ name: 'max_extra_weekly_hours', type: 'int', nullable: true })
  max_extra_weekly_hours: number | null;

  @Column({ name: 'max_lessons_per_day', type: 'int', nullable: true })
  max_lessons_per_day: number | null;

  @Column({ name: 'min_work_days', type: 'int', nullable: true })
  min_work_days: number | null;

  @Column({ name: 'max_work_days', type: 'int', nullable: true })
  max_work_days: number | null;

  @Column({ name: 'allow_am_pm_gap', type: 'boolean', default: true })
  allow_am_pm_gap: boolean;

  @Column({ name: 'unavailable_periods', type: 'jsonb', default: [] })
  unavailable_periods: unknown[];

  @Column({ type: 'jsonb', default: {} })
  constraints: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @ManyToOne(() => DersDagitStudio, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'studio_id' })
  studio: DersDagitStudio;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
