import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { DersDagitStudio } from './ders-dagit-studio.entity';
import { DersDagitGroup } from './ders-dagit-group.entity';

@Entity('ders_dagit_elective_pool')
export class DersDagitElectivePool {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'studio_id', type: 'uuid' })
  studio_id: string;

  @Column({ type: 'varchar', length: 128 })
  name: string;

  @Column({ name: 'base_section', type: 'varchar', length: 64 })
  base_section: string;

  @Column({ name: 'member_sections', type: 'jsonb', default: [] })
  member_sections: string[];

  @Column({ name: 'subject_names', type: 'jsonb', default: [] })
  subject_names: string[];

  @Column({ name: 'group_id', type: 'uuid', nullable: true })
  group_id: string | null;

  @Column({ name: 'weekly_hours_per_track', type: 'int', default: 2 })
  weekly_hours_per_track: number;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sort_order: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @ManyToOne(() => DersDagitStudio, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'studio_id' })
  studio: DersDagitStudio;

  @ManyToOne(() => DersDagitGroup, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'group_id' })
  group: DersDagitGroup | null;
}
