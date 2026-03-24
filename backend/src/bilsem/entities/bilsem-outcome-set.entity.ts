import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { BilsemOutcomeItem } from './bilsem-outcome-item.entity';

@Entity('bilsem_outcome_set')
export class BilsemOutcomeSet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'yetenek_alani', type: 'varchar', length: 64, default: '' })
  yetenekAlani: string;

  @Column({ name: 'yetenek_label', type: 'varchar', length: 128, nullable: true })
  yetenekLabel: string | null;

  @Column({ name: 'grup_adi', type: 'varchar', length: 128, nullable: true })
  grupAdi: string | null;

  @Column({ type: 'int', nullable: true })
  grade: number | null;

  @Column({ name: 'academic_year', type: 'varchar', length: 16, nullable: true })
  academicYear: string | null;

  @Column({ name: 'subject_code', type: 'varchar', length: 64, nullable: true })
  subjectCode: string | null;

  @Column({ name: 'subject_label', type: 'varchar', length: 256, nullable: true })
  subjectLabel: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => BilsemOutcomeItem, (item) => item.bilsemOutcomeSet)
  items: BilsemOutcomeItem[];
}
