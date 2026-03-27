import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { DutySlot } from './duty-slot.entity';
import { DutyCoverage } from './duty-coverage.entity';
import { User } from '../../users/entities/user.entity';

export type DutySwapStatus = 'pending' | 'approved' | 'rejected' | 'reverted';

@Entity('duty_swap_request')
export class DutySwapRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'duty_slot_id', type: 'uuid' })
  duty_slot_id: string;

  @Column({ name: 'school_id', type: 'uuid' })
  school_id: string;

  /** Talebi yapan öğretmen (slot.user_id ile aynı olmalı) */
  @Column({ name: 'requested_by_user_id', type: 'uuid' })
  requested_by_user_id: string;

  /** 'swap' = nöbet günü takas, 'day_change' = gün/ders değişimi (proposed_user_id opsiyonel), 'coverage_swap' = ders görevi değişimi */
  @Column({ name: 'request_type', type: 'varchar', length: 32, default: 'swap' })
  request_type: 'swap' | 'day_change' | 'coverage_swap';

  /** Takas teklif edilen öğretmen (day_change'de null olabilir) */
  @Column({ name: 'proposed_user_id', type: 'uuid', nullable: true })
  proposed_user_id: string | null;

  /** Öğretmen B'nin onay durumu: swap ve coverage_swap için 'pending'; day_change için null */
  @Column({ name: 'teacher2_status', type: 'varchar', length: 16, nullable: true, default: null })
  teacher2_status: 'pending' | 'approved' | 'rejected' | null;

  /** coverage_swap tipinde hangi DutyCoverage kaydının değiştirilmesi isteniyor */
  @Column({ name: 'coverage_id', type: 'uuid', nullable: true, default: null })
  coverage_id: string | null;

  @Column({ type: 'varchar', length: 32, default: 'pending' })
  status: DutySwapStatus;

  @Column({ name: 'admin_note', type: 'text', nullable: true })
  admin_note: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @ManyToOne(() => DutySlot)
  @JoinColumn({ name: 'duty_slot_id' })
  duty_slot: DutySlot;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'requested_by_user_id' })
  requestedByUser: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'proposed_user_id' })
  proposedUser: User | null;

  @ManyToOne(() => DutyCoverage, { nullable: true })
  @JoinColumn({ name: 'coverage_id' })
  coverage: DutyCoverage | null;
}
