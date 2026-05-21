import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { School } from '../../schools/entities/school.entity';

@Entity('optik_scan_results')
@Index(['schoolId', 'scannedAt'])
@Index(['userId', 'scannedAt'])
export class OptikScanResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'school_id', type: 'uuid', nullable: true })
  schoolId: string | null;

  @ManyToOne(() => School, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'school_id' })
  school: School | null;

  @Column({ name: 'template_id', type: 'uuid' })
  templateId: string;

  @Column({ name: 'template_name', length: 128 })
  templateName: string;

  @Column({ name: 'exam_type', type: 'varchar', length: 32, nullable: true })
  examType: string | null;

  @Column({ length: 16, default: 'mc' })
  kind: string;

  @Column({ name: 'class_id', type: 'uuid', nullable: true })
  classId: string | null;

  @Column({ name: 'class_name', type: 'varchar', length: 128, nullable: true })
  className: string | null;

  @Column({ name: 'subject_id', type: 'uuid', nullable: true })
  subjectId: string | null;

  @Column({ name: 'subject_name', type: 'varchar', length: 128, nullable: true })
  subjectName: string | null;

  @Column({ name: 'session_id', type: 'uuid', nullable: true })
  sessionId: string | null;

  @Column({ name: 'student_id', type: 'uuid', nullable: true })
  studentId: string | null;

  @Column({ name: 'student_label', type: 'varchar', length: 64, nullable: true })
  studentLabel: string | null;

  @Column({ type: 'jsonb', default: [] })
  answers: Array<{ question: number; label: string; choice?: number }>;

  @Column({ name: 'answer_count', type: 'int', default: 0 })
  answerCount: number;

  @Column({ name: 'ambiguous_count', type: 'int', default: 0 })
  ambiguousCount: number;

  @Column({ type: 'float', nullable: true })
  confidence: number | null;

  @Column({ name: 'anchor_score', type: 'float', nullable: true })
  anchorScore: number | null;

  @Column({ name: 'grade_score', type: 'float', nullable: true })
  gradeScore: number | null;

  @Column({ name: 'grade_max_score', type: 'float', nullable: true })
  gradeMaxScore: number | null;

  @Column({ name: 'grade_mode', type: 'varchar', length: 32, nullable: true })
  gradeMode: string | null;

  @Column({ name: 'correct_count', type: 'int', nullable: true })
  correctCount: number | null;

  @Column({ name: 'wrong_count', type: 'int', nullable: true })
  wrongCount: number | null;

  @Column({ name: 'blank_count', type: 'int', nullable: true })
  blankCount: number | null;

  @Column({ name: 'net_score', type: 'float', nullable: true })
  netScore: number | null;

  @Column({ name: 'open_grades', type: 'jsonb', nullable: true })
  openGrades: Array<{ question_id: string; score: number; max_score: number }> | null;

  @CreateDateColumn({ name: 'scanned_at' })
  scannedAt: Date;
}
