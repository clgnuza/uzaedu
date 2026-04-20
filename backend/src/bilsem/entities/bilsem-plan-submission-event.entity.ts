import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { BilsemPlanSubmission } from './bilsem-plan-submission.entity';

@Entity('bilsem_plan_submission_event')
export class BilsemPlanSubmissionEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'submission_id', type: 'uuid' })
  submissionId: string;

  @ManyToOne(() => BilsemPlanSubmission, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'submission_id' })
  submission: BilsemPlanSubmission;

  @Column({ name: 'from_status', type: 'varchar', length: 24, nullable: true })
  fromStatus: string | null;

  @Column({ name: 'to_status', type: 'varchar', length: 24 })
  toStatus: string;

  @Column({ name: 'actor_user_id', type: 'uuid' })
  actorUserId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'actor_user_id' })
  actor: User;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
