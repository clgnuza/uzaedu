import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { School } from '../../schools/entities/school.entity';
import { User } from '../../users/entities/user.entity';

export type ButterflyExamPlanStatus = 'draft' | 'published' | 'archived';

@Entity('butterfly_exam_plans')
@Index(['schoolId', 'examStartsAt'])
export class ButterflyExamPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'exam_starts_at', type: 'timestamptz' })
  examStartsAt: Date;

  @Column({ name: 'exam_ends_at', type: 'timestamptz', nullable: true })
  examEndsAt: Date | null;

  @Column({ type: 'varchar', length: 24, default: 'draft' })
  status: ButterflyExamPlanStatus;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  rules: Record<string, unknown>;

  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school: School;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_user_id' })
  createdByUser: User | null;
}
