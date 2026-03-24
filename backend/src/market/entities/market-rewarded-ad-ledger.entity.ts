import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/** AdMob SSV ile doğrulanan ödüllü reklam jeton kazanımları */
@Entity('market_rewarded_ad_ledger')
@Index(['userId', 'createdAt'])
export class MarketRewardedAdLedger {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /** AdMob reward grant — tekil; tekrar işlenmez */
  @Column({ name: 'transaction_id', type: 'varchar', length: 128, unique: true })
  transactionId: string;

  @Column({ name: 'jeton_credit', type: 'numeric', precision: 14, scale: 6 })
  jetonCredit: string;

  @Column({ name: 'ad_unit_key', type: 'varchar', length: 64, nullable: true })
  adUnitKey: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
