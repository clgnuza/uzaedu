import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { DersDagitStudio } from './ders-dagit-studio.entity';
import type { ProgramShareSettings } from '../ders-dagit-program-share';

@Entity('ders_dagit_program')
export class DersDagitProgram {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'studio_id', type: 'uuid' })
  studio_id: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  name: string | null;

  @Column({ type: 'varchar', length: 32, default: 'draft' })
  status: string;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ type: 'int', nullable: true })
  score: number | null;

  @Column({ name: 'is_favorite', type: 'boolean', default: false })
  is_favorite: boolean;

  @Column({ name: 'valid_from', type: 'date', nullable: true })
  valid_from: string | null;

  @Column({ name: 'valid_until', type: 'date', nullable: true })
  valid_until: string | null;

  @Column({ name: 'published_plan_id', type: 'uuid', nullable: true })
  published_plan_id: string | null;

  @Column({ name: 'generation_meta', type: 'jsonb', default: {} })
  generation_meta: Record<string, unknown>;

  @Column({ name: 'share_token', type: 'varchar', length: 64, nullable: true })
  share_token: string | null;

  @Column({ name: 'share_settings', type: 'jsonb', default: {} })
  share_settings: ProgramShareSettings;

  @Column({ name: 'archived_at', type: 'timestamptz', nullable: true })
  archived_at: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @ManyToOne(() => DersDagitStudio, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'studio_id' })
  studio: DersDagitStudio;
}
