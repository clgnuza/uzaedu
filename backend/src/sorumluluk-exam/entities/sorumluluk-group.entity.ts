import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { SorumlulukProctorRules } from '../sorumluluk-proctor-rules';

@Entity('sorumluluk_groups')
export class SorumlulukGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ name: 'academic_year', type: 'varchar', length: 50, nullable: true })
  academicYear: string | null;

  @Column({ name: 'exam_type', type: 'varchar', length: 20, default: 'sorumluluk' })
  examType: 'sorumluluk' | 'beceri';

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status: 'draft' | 'active' | 'completed' | 'archived';

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'proctor_rules', type: 'jsonb', nullable: true })
  proctorRules: SorumlulukProctorRules | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
