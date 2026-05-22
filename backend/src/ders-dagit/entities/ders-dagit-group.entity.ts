import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { DersDagitStudio } from './ders-dagit-studio.entity';

@Entity('ders_dagit_group')
export class DersDagitGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'studio_id', type: 'uuid' })
  studio_id: string;

  @Column({ type: 'varchar', length: 64 })
  name: string;

  @Column({ type: 'varchar', length: 8 })
  abbreviation: string;

  @Column({ type: 'varchar', length: 16, nullable: true })
  color: string | null;

  @Column({ name: 'parallel_mode', type: 'varchar', length: 32, nullable: true })
  parallel_mode: string | null;

  /** Alt şube etiketleri: 5A-A, 5A-B */
  @Column({ name: 'member_sections', type: 'jsonb', default: [] })
  member_sections: string[];

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sort_order: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @ManyToOne(() => DersDagitStudio, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'studio_id' })
  studio: DersDagitStudio;
}
