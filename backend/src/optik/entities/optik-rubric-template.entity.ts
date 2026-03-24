import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('optik_rubric_templates')
export class OptikRubricTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 64, unique: true })
  slug: string;

  @Column({ length: 128 })
  name: string;

  @Column({ length: 32 })
  mode: string;

  @Column({ name: 'subject', type: 'varchar', length: 64, nullable: true })
  subject: string | null;

  @Column({ type: 'jsonb', default: [] })
  criteria: Array<{ criterion: string; max_points: number; weight?: number }>;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
