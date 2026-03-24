import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { OutcomeItem } from './outcome-item.entity';

@Entity('outcome_set')
export class OutcomeSet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'subject_code', type: 'varchar', length: 64 })
  subjectCode: string;

  @Column({ name: 'subject_label', type: 'varchar', length: 128 })
  subjectLabel: string;

  @Column({ type: 'int' })
  grade: number;

  @Column({ type: 'varchar', length: 16, nullable: true })
  section: string | null;

  @Column({ name: 'academic_year', type: 'varchar', length: 16, nullable: true })
  academicYear: string | null;

  @Column({ name: 'source_type', type: 'varchar', length: 32, default: 'manual' })
  sourceType: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => OutcomeItem, (item) => item.outcomeSet)
  items: OutcomeItem[];
}
