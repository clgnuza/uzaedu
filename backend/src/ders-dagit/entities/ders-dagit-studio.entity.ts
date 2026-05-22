import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { School } from '../../schools/entities/school.entity';
import { User } from '../../users/entities/user.entity';

export type DersDagitWorkflowStatus =
  | 'setup'
  | 'collecting_prefs'
  | 'ready'
  | 'generating'
  | 'generated'
  | 'council_review'
  | 'published';

@Entity('ders_dagit_studio')
export class DersDagitStudio {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'school_id', type: 'uuid' })
  school_id: string;

  @Column({ name: 'academic_year', type: 'varchar', length: 16, default: '' })
  academic_year: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  name: string | null;

  @Column({ name: 'workflow_status', type: 'varchar', length: 32, default: 'setup' })
  workflow_status: DersDagitWorkflowStatus;

  @Column({ type: 'jsonb', default: {} })
  settings: Record<string, unknown>;

  @Column({ name: 'health_score', type: 'int', default: 0 })
  health_score: number;

  @Column({ name: 'preference_window_open', type: 'boolean', default: false })
  preference_window_open: boolean;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  created_by: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school: School;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  createdBy: User | null;
}
