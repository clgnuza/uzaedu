import {
  Entity,
  PrimaryColumn,
  CreateDateColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ExamDuty } from './exam-duty.entity';
import { User } from '../../users/entities/user.entity';

/**
 * Öğretmenin bu sınavda görev çıktığını işaretlemesi.
 * Sadece atanan öğretmenlere sınav günü sabah hatırlatması gider.
 * preferred_exam_date: NULL = her gün (aralık boyunca); set = sadece o güne bildirim.
 */
@Entity('exam_duty_assignments')
export class ExamDutyAssignment {
  @PrimaryColumn({ name: 'exam_duty_id', type: 'uuid' })
  examDutyId: string;

  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  /** Çok günlü sınavda sadece bu tarihte sabah bildirimi al. NULL = aralıktaki her gün. */
  @Column({ name: 'preferred_exam_date', type: 'date', nullable: true })
  preferredExamDate: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => ExamDuty, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'exam_duty_id' })
  examDuty: ExamDuty | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;
}
