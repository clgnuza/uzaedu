import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { School } from '../../schools/entities/school.entity';
import { User } from '../../users/entities/user.entity';
import { SchoolTimetablePlan } from './school-timetable-plan.entity';

/** Öğretmen haftalık ders programı – nöbet dağılımı ve günlük tablo için. plan_id varsa tarih bazlı geçerlilik uygulanır. */
@Entity('teacher_timetable')
export class TeacherTimetable {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'school_id', type: 'uuid' })
  school_id: string;

  @Column({ name: 'plan_id', type: 'uuid', nullable: true })
  plan_id: string | null;

  @Column({ name: 'user_id', type: 'uuid' })
  user_id: string;

  /** Haftanın günü: 1=Pazartesi … 5=Cuma */
  @Column({ name: 'day_of_week', type: 'smallint' })
  day_of_week: number;

  /** Ders saati numarası: 1–12 (opsiyonel, okula göre 6–12) */
  @Column({ name: 'lesson_num', type: 'smallint' })
  lesson_num: number;

  @Column({ name: 'class_section', type: 'varchar', length: 32 })
  class_section: string;

  @Column({ type: 'varchar', length: 128 })
  subject: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school: School;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => SchoolTimetablePlan, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'plan_id' })
  plan: SchoolTimetablePlan | null;
}
