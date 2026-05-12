import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { School } from '../../schools/entities/school.entity';
import { User } from '../../users/entities/user.entity';

export type YollukCalculationKind = 'gecici' | 'surekli';
export type YollukCalculationStatus = 'draft' | 'final';

@Entity('yolluk_calculation')
@Index(['school_id', 'created_at'])
@Index(['teacher_user_id', 'created_at'])
export class YollukCalculation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'school_id', type: 'uuid' })
  school_id: string;

  @Column({ name: 'teacher_user_id', type: 'uuid' })
  teacher_user_id: string;

  @Column({ type: 'varchar', length: 16 })
  kind: YollukCalculationKind;

  @Column({ type: 'varchar', length: 16, default: 'draft' })
  status: YollukCalculationStatus;

  @Column({ type: 'varchar', length: 256, nullable: true })
  title: string | null;

  @Column({ type: 'jsonb' })
  inputs: Record<string, unknown>;

  @Column({ type: 'jsonb' })
  result: Record<string, unknown>;

  @Column({ name: 'rules_snapshot', type: 'jsonb' })
  rules_snapshot: Record<string, unknown>;

  @Column({ name: 'created_by_user_id', type: 'uuid' })
  created_by_user_id: string;

  @Column({ name: 'finalized_at', type: 'timestamptz', nullable: true })
  finalized_at: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school: School;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacher_user_id' })
  teacher: User;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_user_id' })
  createdBy: User;
}
