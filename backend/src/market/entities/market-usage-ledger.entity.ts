import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/** Jeton / ek ders modül kullanımı (bakiye düşümü) — aylık / yıllık raporlama için */
@Entity('market_usage_ledger')
@Index(['userId', 'createdAt'])
@Index(['schoolId', 'createdAt'])
export class MarketUsageLedger {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** İşlemi yapan kullanıcı */
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /** Okul cüzdanı düşümünde okul; bireyselde null olabilir */
  @Column({ name: 'school_id', type: 'uuid', nullable: true })
  schoolId: string | null;

  @Column({ name: 'debit_target', type: 'varchar', length: 16 })
  debitTarget: 'user' | 'school';

  @Column({ name: 'module_key', type: 'varchar', length: 32 })
  moduleKey: string;

  @Column({ name: 'jeton_debit', type: 'numeric', precision: 14, scale: 6, default: 0 })
  jetonDebit: string;

  @Column({ name: 'ekders_debit', type: 'numeric', precision: 14, scale: 6, default: 0 })
  ekdersDebit: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
