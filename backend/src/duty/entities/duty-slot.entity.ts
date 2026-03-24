import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { DutyPlan } from './duty-plan.entity';
import { User } from '../../users/entities/user.entity';

@Entity('duty_slot')
export class DutySlot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'duty_plan_id', type: 'uuid' })
  duty_plan_id: string;

  /** Nöbet tarihi */
  @Column({ type: 'date' })
  date: string;

  /** Vardiya: morning | afternoon (tekli eğitimde morning) */
  @Column({ type: 'varchar', length: 16, default: 'morning' })
  shift: 'morning' | 'afternoon';

  /** Slot/saat adı (örn. "Sabah", "1-4", "Öğle") – opsiyonel */
  @Column({ name: 'slot_name', type: 'varchar', length: 64, nullable: true })
  slot_name: string | null;

  /** Nöbet giriş saati (HH:mm). MEB: ilk ders -30 dk. */
  @Column({ name: 'slot_start_time', type: 'varchar', length: 5, nullable: true })
  slot_start_time: string | null;

  /** Nöbet çıkış saati (HH:mm). MEB: son ders +30 dk. */
  @Column({ name: 'slot_end_time', type: 'varchar', length: 5, nullable: true })
  slot_end_time: string | null;

  /** Nöbet alanı (Koridor, Bahçe, Giriş, Zemin Kat vb.) */
  @Column({ name: 'area_name', type: 'varchar', length: 128, nullable: true })
  area_name: string | null;

  /**
   * Hangi ders saatinde nöbet? (1-12, null = vardiya bazlı genel)
   * Gelmeyen işlenince bu saatte boş olan nöbetçiler önerilir.
   */
  @Column({ name: 'lesson_num', type: 'int', nullable: true })
  lesson_num: number | null;

  /**
   * Bu nöbet kaç ders saatine denk? (adil dağılım ağırlığı)
   * Yerine görevlendirmede kapsamılan ders saati sayısı; normal nöbette 1.
   */
  @Column({ name: 'lesson_count', type: 'int', default: 1 })
  lesson_count: number;

  @Column({ name: 'user_id', type: 'uuid' })
  user_id: string;

  /** Yerine görevlendirme: önceki öğretmen */
  @Column({ name: 'reassigned_from_user_id', type: 'uuid', nullable: true })
  reassigned_from_user_id: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  /** Gelmeyen işaretlendi mi? */
  @Column({ name: 'absent_marked_at', type: 'timestamptz', nullable: true })
  absent_marked_at: Date | null;

  /** Gelmeyen tipi: raporlu, izinli, gelmeyen */
  @Column({ name: 'absent_type', type: 'varchar', length: 32, nullable: true })
  absent_type: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @ManyToOne(() => DutyPlan, (plan) => plan.slots, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'duty_plan_id' })
  duty_plan: DutyPlan;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'reassigned_from_user_id' })
  reassignedFromUser: User | null;
}
