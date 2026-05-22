import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { DersDagitStudio } from './ders-dagit-studio.entity';
import { User } from '../../users/entities/user.entity';

@Entity('ders_dagit_audit_log')
export class DersDagitAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'studio_id', type: 'uuid' })
  studio_id: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  user_id: string | null;

  @Column({ type: 'varchar', length: 64 })
  action: string;

  @Column({ type: 'jsonb', default: {} })
  detail: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @ManyToOne(() => DersDagitStudio, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'studio_id' })
  studio: DersDagitStudio;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;
}
