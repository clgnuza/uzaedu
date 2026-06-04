import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('optik_omr_feedback')
export class OptikOmrFeedback {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'template_id', type: 'uuid' })
  templateId: string;

  @Column({ name: 'scan_result_id', type: 'uuid', nullable: true })
  scanResultId: string | null;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'int' })
  question: number;

  @Column({ name: 'detected_label', type: 'varchar', length: 8 })
  detectedLabel: string;

  @Column({ name: 'corrected_label', type: 'varchar', length: 8 })
  correctedLabel: string;

  @Column({ name: 'student_code', type: 'varchar', length: 32, nullable: true })
  studentCode: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
