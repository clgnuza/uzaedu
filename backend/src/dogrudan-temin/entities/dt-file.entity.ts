import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('dt_files')
export class DtFile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @Column({ type: 'int' })
  year: number;

  @Column({ name: 'file_no', type: 'varchar', length: 32 })
  fileNo: string;

  @Column({ type: 'varchar', length: 512 })
  subject: string;

  @Column({ name: 'temin_type', type: 'varchar', length: 16 })
  teminType: string;

  @Column({ type: 'varchar', length: 32, default: 'draft' })
  status: string;

  @Column({ name: 'award_mode', type: 'varchar', length: 32, default: 'manual' })
  awardMode: string;

  @Column({ name: 'budget_account_id', type: 'uuid', nullable: true })
  budgetAccountId: string | null;

  @Column({ name: 'approx_total', type: 'numeric', precision: 14, scale: 6, nullable: true })
  approxTotal: string | null;

  @Column({ name: 'decision_total', type: 'numeric', precision: 14, scale: 6, nullable: true })
  decisionTotal: string | null;

  @Column({ name: 'payment_total', type: 'numeric', precision: 14, scale: 6, nullable: true })
  paymentTotal: string | null;

  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @Column({ name: 'updated_by_user_id', type: 'uuid', nullable: true })
  updatedByUserId: string | null;

  @Column({ name: 'archived_at', type: 'timestamptz', nullable: true })
  archivedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

