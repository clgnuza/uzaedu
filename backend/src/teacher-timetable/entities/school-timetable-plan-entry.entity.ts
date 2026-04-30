import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { SchoolTimetablePlan } from './school-timetable-plan.entity';
import { User } from '../../users/entities/user.entity';

@Entity('school_timetable_plan_entry')
export class SchoolTimetablePlanEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'plan_id', type: 'uuid' })
  plan_id: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  user_id: string | null;

  @Column({ name: 'teacher_name_raw', type: 'varchar', length: 160, nullable: true })
  teacher_name_raw: string | null;

  @Column({ name: 'day_of_week', type: 'smallint' })
  day_of_week: number;

  @Column({ name: 'lesson_num', type: 'smallint' })
  lesson_num: number;

  @Column({ name: 'class_section', type: 'varchar', length: 32 })
  class_section: string;

  @Column({ type: 'varchar', length: 128 })
  subject: string;

  @ManyToOne(() => SchoolTimetablePlan, (plan) => plan.entries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'plan_id' })
  plan: SchoolTimetablePlan;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;
}
