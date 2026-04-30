import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { BilsemPlanSubmission } from './bilsem-plan-submission.entity';

@Entity('bilsem_plan_submission_like')
@Unique('uq_bilsem_plan_like_sub_user', ['submissionId', 'userId'])
@Index('idx_bilsem_plan_like_sub', ['submissionId'])
export class BilsemPlanSubmissionLike {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'submission_id', type: 'uuid' })
  submissionId: string;

  @ManyToOne(() => BilsemPlanSubmission, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'submission_id' })
  submission: BilsemPlanSubmission;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
