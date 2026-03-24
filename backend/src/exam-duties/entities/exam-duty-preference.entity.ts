import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('exam_duty_preferences')
export class ExamDutyPreference {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @PrimaryColumn({ name: 'category_slug', type: 'varchar', length: 32 })
  categorySlug: string;

  @Column({ name: 'pref_publish', type: 'boolean', default: true })
  prefPublish: boolean;

  @Column({ name: 'pref_deadline', type: 'boolean', default: true })
  prefDeadline: boolean;

  @Column({ name: 'pref_approval_day', type: 'boolean', default: true })
  prefApprovalDay: boolean;

  @Column({ name: 'pref_exam_minus_1d', type: 'boolean', default: true })
  prefExamMinus1d: boolean;

  @Column({ name: 'pref_exam_plus_1d', type: 'boolean', default: true })
  prefExamPlus1d: boolean;

  /** Sadece "görev çıktı" işaretleyen öğretmenlere sınav günü sabah hatırlatması */
  @Column({ name: 'pref_exam_day_morning', type: 'boolean', default: true })
  prefExamDayMorning: boolean;

  /** Sabah hatırlatması saati (HH:mm, Turkey). Varsayılan 08:00. */
  @Column({ name: 'pref_exam_day_morning_time', type: 'varchar', length: 5, default: '08:00' })
  prefExamDayMorningTime: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;
}
