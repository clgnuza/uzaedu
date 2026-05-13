import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export type DtBudgetBlockStatus = 'blocked' | 'released';

@Entity('dt_budget_blocks')
export class DtBudgetBlock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @Column({ name: 'dt_file_id', type: 'uuid' })
  dtFileId: string;

  @Column({ name: 'budget_account_id', type: 'uuid' })
  budgetAccountId: string;

  @Column({ type: 'numeric', precision: 14, scale: 6 })
  amount: string;

  @Column({ type: 'varchar', length: 16, default: 'blocked' })
  status: DtBudgetBlockStatus;

  @Column({ name: 'blocked_at', type: 'timestamptz', nullable: true })
  blockedAt: Date | null;

  @Column({ name: 'released_at', type: 'timestamptz', nullable: true })
  releasedAt: Date | null;

  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @Column({ name: 'updated_by_user_id', type: 'uuid', nullable: true })
  updatedByUserId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

