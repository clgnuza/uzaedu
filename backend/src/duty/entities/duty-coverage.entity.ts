import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { DutySlot } from './duty-slot.entity';
import { User } from '../../users/entities/user.entity';

/**
 * Gelmeyen öğretmenin nöbet saatlerini ders bazında kapatan görevlendirme.
 *
 * Örnek akış:
 *   Ayşe öğretmen sabah nöbetçi; 2., 4. ve 5. derslerde boş.
 *   → DutyCoverage(lesson_num=2, covered_by=Mehmet)
 *   → DutyCoverage(lesson_num=4, covered_by=Fatma)
 *   → DutyCoverage(lesson_num=5, covered_by=Ali)
 *
 * Her kayıt adil dağılım istatistiğinde 1 ders saati olarak sayılır.
 */
@Entity('duty_coverage')
export class DutyCoverage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Gelmeyen öğretmenin nöbet slotu */
  @Column({ name: 'duty_slot_id', type: 'uuid' })
  duty_slot_id: string;

  /** Kapsanması gereken ders saati (1–12) */
  @Column({ name: 'lesson_num', type: 'smallint' })
  lesson_num: number;

  /** Görevlendirilen öğretmen (null = henüz atanmadı) */
  @Column({ name: 'covered_by_user_id', type: 'uuid', nullable: true })
  covered_by_user_id: string | null;

  /** İsteğe bağlı not */
  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @ManyToOne(() => DutySlot, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'duty_slot_id' })
  duty_slot: DutySlot;

  @ManyToOne(() => User, { nullable: true, eager: false })
  @JoinColumn({ name: 'covered_by_user_id' })
  covered_by_user: User | null;
}
