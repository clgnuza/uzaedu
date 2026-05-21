import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { School } from '../../schools/entities/school.entity';

export type OptikScoringMode = 'standard' | 'penalty_4_1';

@Entity('optik_exam_sessions')
@Index(['userId', 'createdAt'])
@Index(['schoolId', 'createdAt'])
export class OptikExamSession {
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

  @Column({ length: 256 })
  title: string;

  @Column({ name: 'template_id', type: 'uuid' })
  templateId: string;

  @Column({ name: 'template_name', length: 128 })
  templateName: string;

  @Column({ name: 'exam_type', type: 'varchar', length: 32, nullable: true })
  examType: string | null;

  @Column({ name: 'class_id', type: 'uuid', nullable: true })
  classId: string | null;

  @Column({ name: 'class_name', type: 'varchar', length: 128, nullable: true })
  className: string | null;

  @Column({ name: 'subject_id', type: 'uuid', nullable: true })
  subjectId: string | null;

  @Column({ name: 'subject_name', type: 'varchar', length: 128, nullable: true })
  subjectName: string | null;

  @Column({ name: 'question_count', type: 'int', default: 20 })
  questionCount: number;

  @Column({ name: 'choice_count', type: 'int', default: 5 })
  choiceCount: number;

  /** { "1": "A", "2": "C", ... } */
  @Column({ name: 'answer_key', type: 'jsonb', default: {} })
  answerKey: Record<string, string>;

  @Column({ name: 'scoring_mode', length: 32, default: 'standard' })
  scoringMode: OptikScoringMode;

  @Column({ length: 16, default: 'active' })
  status: string;

  /** Açık uçlu sorular: [{ id, title, max_score, mode }] */
  @Column({ name: 'open_questions', type: 'jsonb', default: [] })
  openQuestions: Array<{ id: string; title: string; max_score: number; mode?: string; key_text?: string }>;

  @Column({ name: 'exam_date', type: 'date', nullable: true })
  examDate: string | null;

  @Column({ name: 'butterfly_plan_id', type: 'uuid', nullable: true })
  butterflyPlanId: string | null;

  /** Kazanım takip plan anahtarı: subject:grade:year:section */
  @Column({ name: 'outcome_plan_key', type: 'varchar', length: 256, nullable: true })
  outcomePlanKey: string | null;

  /** { "1": { label, plan_item_id?, week_order?, konu? }, ... } */
  @Column({ name: 'question_outcomes', type: 'jsonb', default: {} })
  questionOutcomes: Record<
    string,
    { label: string; plan_item_id?: string; week_order?: number; konu?: string }
  >;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
