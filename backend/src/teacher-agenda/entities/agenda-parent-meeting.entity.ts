import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Student } from '../../students/entities/student.entity';

@Entity('agenda_parent_meetings')
export class AgendaParentMeeting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @Column({ name: 'teacher_id', type: 'uuid' })
  teacherId: string;

  @Column({ name: 'meeting_date', type: 'date' })
  meetingDate: string;

  @Column({ name: 'meeting_type', type: 'varchar', length: 64, nullable: true })
  meetingType: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  subject: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'follow_up_date', type: 'date', nullable: true })
  followUpDate: string | null;

  @Column({ name: 'reminder_created', type: 'boolean', default: false })
  reminderCreated: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacher_id' })
  teacher: User;
}
