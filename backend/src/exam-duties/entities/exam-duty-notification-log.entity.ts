import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ExamDuty } from './exam-duty.entity';
import { User } from '../../users/entities/user.entity';

export type ExamDutyNotificationReason =
  | 'publish_now'
  | 'apply_start'
  | 'deadline'
  | 'approval_day'
  | 'exam_minus_1d'
  | 'exam_plus_1d'
  | 'exam_day_morning';

@Entity('exam_duty_notification_log')
export class ExamDutyNotificationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'exam_duty_id', type: 'uuid' })
  examDutyId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 32 })
  reason: string;

  @CreateDateColumn({ name: 'sent_at' })
  sentAt: Date;

  @ManyToOne(() => ExamDuty, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'exam_duty_id' })
  examDuty: ExamDuty | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;
}
