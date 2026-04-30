import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { School } from '../../schools/entities/school.entity';

export type YillikPlanSubmissionStatus = 'draft' | 'pending_review' | 'published' | 'rejected' | 'withdrawn';

@Entity('yillik_plan_submission')
@Index('idx_yps_author_updated_at', ['authorUserId', 'updatedAt'])
@Index('idx_yps_author_status', ['authorUserId', 'status'])
export class YillikPlanSubmission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'author_user_id', type: 'uuid' })
  authorUserId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_user_id' })
  author: User;

  @Column({ name: 'school_id', type: 'uuid', nullable: true })
  schoolId: string | null;

  @ManyToOne(() => School, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'school_id' })
  school: School | null;

  @Column({ type: 'varchar', length: 24, default: 'draft' })
  status: YillikPlanSubmissionStatus;

  @Column({ name: 'subject_code', type: 'varchar', length: 64 })
  subjectCode: string;

  @Column({ name: 'subject_label', type: 'varchar', length: 128 })
  subjectLabel: string;

  @Column({ type: 'int' })
  grade: number;

  @Column({ type: 'varchar', length: 16, nullable: true })
  section: string | null;

  @Column({ name: 'academic_year', type: 'varchar', length: 16 })
  academicYear: string;

  @Column({ name: 'tablo_alti_not', type: 'text', nullable: true })
  tabloAltiNot: string | null;

  @Column({ name: 'items_json', type: 'text' })
  itemsJson: string;

  @Column({ name: 'reviewer_user_id', type: 'uuid', nullable: true })
  reviewerUserId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewer_user_id' })
  reviewer: User | null;

  @Column({ name: 'review_note', type: 'text', nullable: true })
  reviewNote: string | null;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt: Date | null;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
