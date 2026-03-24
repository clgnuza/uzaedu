import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { BilsemOutcomeSet } from './bilsem-outcome-set.entity';
import { BilsemPlanItem } from './bilsem-plan-item.entity';

export type BilsemPlanType = 'yillik' | 'donemlik';

@Entity('bilsem_generated_plan')
export class BilsemGeneratedPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'school_id', type: 'uuid', nullable: true })
  schoolId: string | null;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'outcome_set_id', type: 'uuid' })
  outcomeSetId: string;

  @ManyToOne(() => BilsemOutcomeSet, { onDelete: 'SET NULL', nullable: true, eager: false })
  @JoinColumn({ name: 'outcome_set_id' })
  outcomeSet: BilsemOutcomeSet;

  @Column({ name: 'plan_type', type: 'varchar', length: 16 })
  planType: BilsemPlanType;

  @Column({ name: 'donem', type: 'int', nullable: true })
  donem: 1 | 2 | null;

  @Column({ name: 'academic_year', type: 'varchar', length: 16 })
  academicYear: string;

  @Column({ name: 'yetenek_alani', type: 'varchar', length: 64, default: '' })
  yetenekAlani: string;

  @Column({ name: 'grup_adi', type: 'varchar', length: 128, nullable: true })
  grupAdi: string | null;

  @Column({ name: 'grade', type: 'int', nullable: true })
  grade: number | null;

  @Column({ name: 'title', type: 'varchar', length: 256, nullable: true })
  title: string | null;

  @Column({ name: 'weekly_lesson_hours', type: 'int', default: 2 })
  weeklyLessonHours: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => BilsemPlanItem, (item) => item.plan, { cascade: true })
  items: BilsemPlanItem[];
}
