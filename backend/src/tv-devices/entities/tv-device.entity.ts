import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { School } from '../../schools/entities/school.entity';

@Entity('tv_devices')
export class TvDevice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  school_id: string;

  /** Pairing: Cihaz bu kodla okula eşleşir. */
  @Column({ type: 'varchar', length: 16 })
  pairing_code: string;

  /** Kullanıcı tarafından verilen ad (örn. "Koridor 1. kat"). */
  @Column({ type: 'varchar', length: 128, default: 'TV Ekranı' })
  name: string;

  /** Hedef ekran grubu: corridor | teachers. */
  @Column({ type: 'varchar', length: 16, default: 'corridor' })
  display_group: string;

  @Column({ type: 'varchar', length: 16, default: 'offline' })
  status: string;

  @Column({ type: 'timestamptz', nullable: true })
  last_seen_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school: School;
}
