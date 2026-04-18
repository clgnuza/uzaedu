import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

/** Kullanıcının kullanım hakları – evrak_uretim, yillik_plan_uretim, optik_okuma vb. */
@Entity('entitlements')
export class Entitlement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /** evrak_uretim, yillik_plan_uretim, optik_okuma, tahta_kilit vb. */
  @Column({ name: 'entitlement_type', type: 'varchar', length: 64 })
  entitlementType: string;

  /** Kalan adet (sayısal hak). 0 = kotası bitti. */
  @Column({ type: 'int', default: 0 })
  quantity: number;

  /** Süreli hak: bitiş tarihi (opsiyonel) */
  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
