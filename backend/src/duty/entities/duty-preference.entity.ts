import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export type DutyPreferenceStatus = 'available' | 'unavailable' | 'prefer';

@Entity('duty_preference')
export class DutyPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'school_id', type: 'uuid' })
  school_id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  user_id: string;

  /** Tercih tarihi */
  @Column({ type: 'date' })
  date: string;

  /** available: müsait, unavailable: müsait değil, prefer: tercih ediyorum */
  @Column({ type: 'varchar', length: 32, default: 'unavailable' })
  status: DutyPreferenceStatus;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'admin_confirmed_at', type: 'timestamptz', nullable: true })
  admin_confirmed_at: Date | null;

  @Column({ name: 'admin_confirmed_by', type: 'uuid', nullable: true })
  admin_confirmed_by: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
