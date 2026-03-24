import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { School } from '../../schools/entities/school.entity';
import { User } from '../../users/entities/user.entity';

@Entity('optik_form_templates')
export class OptikFormTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 128 })
  name: string;

  @Column({ length: 64 })
  slug: string;

  @Column({ length: 16, default: 'system' })
  scope: string;

  @Column({ name: 'school_id', type: 'uuid', nullable: true })
  schoolId: string | null;

  @ManyToOne(() => School, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'school_id' })
  school: School | null;

  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by_user_id' })
  createdByUser: User | null;

  @Column({ name: 'form_type', length: 32, default: 'multiple_choice' })
  formType: string;

  @Column({ name: 'question_count', type: 'int', default: 20 })
  questionCount: number;

  @Column({ name: 'choice_count', type: 'int', default: 5 })
  choiceCount: number;

  @Column({ name: 'page_size', length: 16, default: 'A4' })
  pageSize: string;

  @Column({ name: 'roi_config', type: 'jsonb', nullable: true })
  roiConfig: Record<string, unknown> | null;

  @Column({ name: 'exam_type', length: 32, default: 'genel' })
  examType: string;

  @Column({ name: 'grade_level', type: 'varchar', length: 16, nullable: true })
  gradeLevel: string | null;

  @Column({ name: 'subject_hint', type: 'varchar', length: 64, nullable: true })
  subjectHint: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
