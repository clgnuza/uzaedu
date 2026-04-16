import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('teacher_evaluation_criteria')
export class TeacherEvaluationCriterion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'teacher_id', type: 'uuid' })
  teacherId: string;

  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @Column({ length: 120 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'max_score', type: 'int', default: 5 })
  maxScore: number;

  /** numeric = 0..maxScore puan; sign = +/0/- (1, 0, -1) */
  @Column({ name: 'score_type', type: 'varchar', length: 16, default: 'numeric' })
  scoreType: 'numeric' | 'sign';

  @Column({ name: 'subject_id', type: 'uuid', nullable: true })
  subjectId: string | null;

  /** lesson = ders kriteri, behavior = davranış */
  @Column({ name: 'criterion_category', type: 'varchar', length: 16, default: 'lesson' })
  criterionCategory: 'lesson' | 'behavior';

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacher_id' })
  teacher: User;
}
