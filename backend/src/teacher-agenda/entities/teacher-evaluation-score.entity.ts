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
import { TeacherEvaluationCriterion } from './teacher-evaluation-criterion.entity';

@Entity('teacher_evaluation_scores')
export class TeacherEvaluationScore {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'criterion_id', type: 'uuid' })
  criterionId: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @Column({ name: 'teacher_id', type: 'uuid' })
  teacherId: string;

  @Column({ type: 'int' })
  score: number;

  @Column({ name: 'note_date', type: 'date' })
  noteDate: string;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => TeacherEvaluationCriterion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'criterion_id' })
  criterion: TeacherEvaluationCriterion;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacher_id' })
  teacher: User;
}
