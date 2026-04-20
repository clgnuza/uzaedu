import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { BilsemPlanSubmission } from './bilsem-plan-submission.entity';
import { DocumentGeneration } from '../../document-templates/entities/document-generation.entity';

@Entity('market_plan_creator_reward_ledger')
export class MarketPlanCreatorRewardLedger {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 128, unique: true })
  idempotencyKey: string;

  @Column({ name: 'creator_user_id', type: 'uuid' })
  creatorUserId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'creator_user_id' })
  creator: User;

  @Column({ name: 'consumer_user_id', type: 'uuid' })
  consumerUserId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'consumer_user_id' })
  consumer: User;

  @Column({ name: 'submission_id', type: 'uuid' })
  submissionId: string;

  @ManyToOne(() => BilsemPlanSubmission, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'submission_id' })
  submission: BilsemPlanSubmission;

  @Column({ name: 'document_generation_id', type: 'uuid', nullable: true })
  documentGenerationId: string | null;

  @ManyToOne(() => DocumentGeneration, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'document_generation_id' })
  documentGeneration: DocumentGeneration | null;

  @Column({ name: 'jeton_credit', type: 'numeric', precision: 14, scale: 6 })
  jetonCredit: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
