import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { SchoolTimetablePlan } from './school-timetable-plan.entity';
import { User } from '../../users/entities/user.entity';

/** Sınıf merkezli program (öğretmen programından türetilir; tahta, TV, nöbet vb.). */
@Entity('school_class_timetable_entry')
@Index(['plan_id', 'day_of_week', 'lesson_num', 'class_section', 'subject'], { unique: true })
export class SchoolClassTimetableEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'plan_id', type: 'uuid' })
  plan_id: string;

  @Column({ name: 'school_id', type: 'uuid' })
  school_id: string;

  @Column({ name: 'day_of_week', type: 'smallint' })
  day_of_week: number;

  @Column({ name: 'lesson_num', type: 'smallint' })
  lesson_num: number;

  @Column({ name: 'class_section', type: 'varchar', length: 32 })
  class_section: string;

  @Column({ type: 'varchar', length: 128 })
  subject: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  user_id: string | null;

  @Column({ name: 'teacher_name', type: 'varchar', length: 160, nullable: true })
  teacher_name: string | null;

  @ManyToOne(() => SchoolTimetablePlan, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'plan_id' })
  plan: SchoolTimetablePlan;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;
}
