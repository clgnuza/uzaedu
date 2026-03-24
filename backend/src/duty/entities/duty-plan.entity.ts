import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { School } from '../../schools/entities/school.entity';
import { User } from '../../users/entities/user.entity';
import { DutySlot } from './duty-slot.entity';

export type DutyPlanStatus = 'draft' | 'published';

@Entity('duty_plan')
export class DutyPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'school_id', type: 'uuid' })
  school_id: string;

  /** Versiyon / açıklama (örn. "Şubat 2026") */
  @Column({ type: 'varchar', length: 64, nullable: true })
  version: string | null;

  @Column({ type: 'varchar', length: 32, default: 'draft' })
  status: DutyPlanStatus;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  published_at: Date | null;

  @Column({ name: 'period_start', type: 'date', nullable: true })
  period_start: string | null;

  @Column({ name: 'period_end', type: 'date', nullable: true })
  period_end: string | null;

  @Column({ name: 'academic_year', type: 'varchar', length: 16, nullable: true })
  academic_year: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  created_by: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @ManyToOne(() => School)
  @JoinColumn({ name: 'school_id' })
  school: School;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  createdByUser: User | null;

  @OneToMany(() => DutySlot, (slot) => slot.duty_plan)
  slots: DutySlot[];
}
