import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/** Google Play / App Store satın alma doğrulama ve işlem günlüğü */
@Entity('market_purchase_ledger')
@Index(['userId', 'createdAt'])
@Index(['purchaseTokenHash'], { unique: false })
export class MarketPurchaseLedger {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'school_id', type: 'uuid', nullable: true })
  schoolId: string | null;

  @Column({ type: 'varchar', length: 16 })
  platform: 'android' | 'ios';

  @Column({ name: 'product_kind', type: 'varchar', length: 24, default: 'unknown' })
  productKind: 'consumable' | 'subscription' | 'unknown';

  @Column({ name: 'currency_kind', type: 'varchar', length: 16, default: 'unknown' })
  currencyKind: 'jeton' | 'ekders' | 'unknown';

  @Column({ name: 'product_id', type: 'varchar', length: 200 })
  productId: string;

  @Column({ type: 'varchar', length: 24 })
  status: 'pending' | 'verified' | 'rejected' | 'skipped_no_credentials' | 'duplicate';

  @Column({ name: 'purchase_token_hash', type: 'varchar', length: 64, nullable: true })
  purchaseTokenHash: string | null;

  @Column({ name: 'verification_note', type: 'text', nullable: true })
  verificationNote: string | null;

  @Column({ name: 'provider_detail', type: 'jsonb', nullable: true })
  providerDetail: Record<string, unknown> | null;

  /** Bakiye yükleme entegrasyonu sonrası true yapılır */
  @Column({ name: 'credits_applied', type: 'boolean', default: false })
  creditsApplied: boolean;

  /** Yüklenen jeton/ek ders miktarı (market politikası IAP eşlemesi) */
  @Column({ name: 'amount_credited', type: 'numeric', precision: 14, scale: 6, nullable: true })
  amountCredited: string | null;

  /** Bakiyenin yüklendiği hedef: kullanıcı veya okul cüzdanı */
  @Column({ name: 'credit_target', type: 'varchar', length: 16, nullable: true })
  creditTarget: 'user' | 'school' | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
