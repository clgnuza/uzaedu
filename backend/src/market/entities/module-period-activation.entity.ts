import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('module_period_activation')
export class ModulePeriodActivation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'school_id', type: 'uuid', nullable: true })
  schoolId: string | null;

  @Column({ name: 'module_key', type: 'varchar', length: 32 })
  moduleKey: string;

  @Column({ name: 'billing_period', type: 'varchar', length: 5 })
  billingPeriod: 'month' | 'year';

  /** Ay: YYYY-MM (UTC); yıl: YYYY (UTC) */
  @Column({ name: 'period_month', type: 'varchar', length: 7 })
  periodMonth: string;

  @Column({ name: 'debit_target', type: 'varchar', length: 8 })
  debitTarget: 'user' | 'school';

  /** Aynı istemci isteğinin tekrarında çift düşümü önlemek için (isteğe bağlı). */
  @Column({ name: 'idempotency_key', type: 'varchar', length: 64, nullable: true })
  idempotencyKey: string | null;

  @Column({ name: 'debit_jeton', type: 'numeric', precision: 14, scale: 6, nullable: true })
  debitJeton: string | null;

  @Column({ name: 'debit_ekders', type: 'numeric', precision: 14, scale: 6, nullable: true })
  debitEkders: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
