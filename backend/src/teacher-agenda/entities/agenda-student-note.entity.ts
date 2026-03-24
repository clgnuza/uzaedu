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

export type AgendaStudentNoteType = 'positive' | 'negative' | 'observation';
export type AgendaStudentNotePrivacy = 'private' | 'school_admin' | 'selected_teachers' | 'all_school';

@Entity('agenda_student_notes')
export class AgendaStudentNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @Column({ name: 'teacher_id', type: 'uuid' })
  teacherId: string;

  @Column({ name: 'note_type', length: 24 })
  noteType: AgendaStudentNoteType;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'subject_id', type: 'uuid', nullable: true })
  subjectId: string | null;

  @Column({ name: 'note_date', type: 'date' })
  noteDate: string;

  @Column({ type: 'jsonb', nullable: true })
  tags: string[] | null;

  @Column({ name: 'privacy_level', length: 32, default: 'private' })
  privacyLevel: AgendaStudentNotePrivacy;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacher_id' })
  teacher: User;
}
