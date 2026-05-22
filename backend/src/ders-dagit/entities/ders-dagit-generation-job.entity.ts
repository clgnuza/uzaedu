import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { DersDagitStudio } from './ders-dagit-studio.entity';

@Entity('ders_dagit_generation_job')
export class DersDagitGenerationJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'studio_id', type: 'uuid' })
  studio_id: string;

  @Column({ type: 'varchar', length: 32, default: 'queued' })
  status: string;

  @Column({ name: 'duration_sec', type: 'int', default: 120 })
  duration_sec: number;

  @Column({ name: 'versions_requested', type: 'int', default: 1 })
  versions_requested: number;

  @Column({ type: 'jsonb', default: {} })
  report: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  started_at: Date | null;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finished_at: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @ManyToOne(() => DersDagitStudio, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'studio_id' })
  studio: DersDagitStudio;
}
