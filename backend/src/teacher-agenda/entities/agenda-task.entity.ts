import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { School } from '../../schools/entities/school.entity';
import { AgendaReminder } from './agenda-reminder.entity';

export type AgendaTaskStatus = 'pending' | 'completed' | 'overdue' | 'postponed';
export type AgendaTaskPriority = 'low' | 'medium' | 'high';
export type AgendaTaskRepeat = 'none' | 'daily' | 'weekly' | 'monthly';
export type AgendaTaskSource = 'PERSONAL' | 'SCHOOL' | 'PLATFORM';

@Entity('agenda_tasks')
export class AgendaTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 512 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: string | null;

  @Column({ name: 'due_time', type: 'varchar', length: 8, nullable: true })
  dueTime: string | null;

  @Column({ type: 'varchar', length: 16, default: 'medium' })
  priority: AgendaTaskPriority;

  @Column({ type: 'varchar', length: 16, default: 'none' })
  repeat: AgendaTaskRepeat;

  @Column({ type: 'varchar', length: 24 })
  status: AgendaTaskStatus;

  @Column({ type: 'varchar', length: 24 })
  source: AgendaTaskSource;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'school_id', type: 'uuid', nullable: true })
  schoolId: string | null;

  @Column({ name: 'assigned_by', type: 'uuid', nullable: true })
  assignedBy: string | null;

  @Column({ name: 'linked_module', type: 'varchar', length: 64, nullable: true })
  linkedModule: string | null;

  @Column({ name: 'linked_entity_id', type: 'varchar', length: 128, nullable: true })
  linkedEntityId: string | null;

  @Column({ name: 'student_id', type: 'uuid', nullable: true })
  studentId: string | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school: School | null;

  @OneToMany(() => AgendaReminder, (r) => r.task)
  reminders: AgendaReminder[];
}
