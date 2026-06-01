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
import { User } from '../../users/entities/user.entity';

export type AvailabilitySubmissionStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'partially_approved'
  | 'rejected';

export type AvailabilityPeriodSlot = {
  day_of_week: number;
  lesson_num?: number | null;
};

@Entity('ders_dagit_availability_submission')
export class DersDagitAvailabilitySubmission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'studio_id', type: 'uuid' })
  studio_id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  user_id: string;

  @Column({ type: 'varchar', length: 32, default: 'draft' })
  status: AvailabilitySubmissionStatus;

  @Column({ type: 'jsonb', default: [] })
  periods: AvailabilityPeriodSlot[];

  @Column({ name: 'approved_periods', type: 'jsonb', nullable: true })
  approved_periods: AvailabilityPeriodSlot[] | null;

  @Column({ name: 'teacher_note', type: 'text', nullable: true })
  teacher_note: string | null;

  @Column({ name: 'admin_reply', type: 'text', nullable: true })
  admin_reply: string | null;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submitted_at: Date | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewed_at: Date | null;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewed_by: string | null;

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
