import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { DersDagitStudio } from './ders-dagit-studio.entity';

@Entity('ders_dagit_subject')
export class DersDagitSubject {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'studio_id', type: 'uuid' })
  studio_id: string;

  @Column({ type: 'varchar', length: 128 })
  name: string;

  @Column({ name: 'short_code', type: 'varchar', length: 16, nullable: true })
  short_code: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  color: string | null;

  @Column({ name: 'is_practical', type: 'boolean', default: false })
  is_practical: boolean;

  @Column({ name: 'is_elective', type: 'boolean', default: false })
  is_elective: boolean;

  @Column({ name: 'class_hours', type: 'jsonb', default: {} })
  class_hours: Record<string, number>;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sort_order: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @ManyToOne(() => DersDagitStudio, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'studio_id' })
  studio: DersDagitStudio;
}
