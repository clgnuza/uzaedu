import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { School } from '../../schools/entities/school.entity';
import { User } from '../../users/entities/user.entity';
import { SchoolTimetablePlanEntry } from './school-timetable-plan-entry.entity';

export type SchoolTimetablePlanStatus = 'draft' | 'published' | 'archived';

@Entity('school_timetable_plan')
export class SchoolTimetablePlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'school_id', type: 'uuid' })
  school_id: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  name: string | null;

  @Column({ name: 'valid_from', type: 'date' })
  valid_from: string;

  @Column({ name: 'valid_until', type: 'date', nullable: true })
  valid_until: string | null;

  @Column({ type: 'varchar', length: 32, default: 'draft' })
  status: SchoolTimetablePlanStatus;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  published_at: Date | null;

  @Column({ name: 'academic_year', type: 'varchar', length: 16, nullable: true })
  academic_year: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  created_by: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school: School;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  createdByUser: User | null;

  @OneToMany(() => SchoolTimetablePlanEntry, (e) => e.plan)
  entries: SchoolTimetablePlanEntry[];
}
