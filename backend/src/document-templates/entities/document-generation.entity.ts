import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { DocumentTemplate } from './document-template.entity';

/** Kullanıcının ürettiği evrakların arşivi – tekrar indirme için metadata */
@Entity('document_generations')
export class DocumentGeneration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'template_id', type: 'uuid', nullable: true })
  templateId: string | null;

  @ManyToOne(() => DocumentTemplate, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'template_id' })
  template: DocumentTemplate | null;

  /** Tam form verisi – tekrar indirme için regenerate'de kullanılır */
  @Column({ name: 'form_data', type: 'jsonb' })
  formData: Record<string, string | number>;

  /** Görüntüleme için: "9. Sınıf · Coğrafya · 2024-2025" */
  @Column({ name: 'display_label', type: 'varchar', length: 256 })
  displayLabel: string;

  @Column({ type: 'varchar', length: 8, nullable: true })
  grade: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  section: string | null;

  @Column({ name: 'subject_code', type: 'varchar', length: 64, nullable: true })
  subjectCode: string | null;

  @Column({ name: 'subject_label', type: 'varchar', length: 128, nullable: true })
  subjectLabel: string | null;

  @Column({ name: 'academic_year', type: 'varchar', length: 16, nullable: true })
  academicYear: string | null;

  @Column({ name: 'file_format', type: 'varchar', length: 16, default: 'docx' })
  fileFormat: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
