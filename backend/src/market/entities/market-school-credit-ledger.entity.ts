import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/** Superadmin tarafından okul market cüzdanına eklenen jeton / ek ders */
@Entity('market_school_credit_ledger')
@Index(['schoolId', 'createdAt'])
export class MarketSchoolCreditLedger {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @Column({ name: 'created_by_user_id', type: 'uuid' })
  createdByUserId: string;

  @Column({ name: 'jeton_credit', type: 'numeric', precision: 14, scale: 6, default: 0 })
  jetonCredit: string;

  @Column({ name: 'ekders_credit', type: 'numeric', precision: 14, scale: 6, default: 0 })
  ekdersCredit: string;

  @Column({ name: 'note', type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
