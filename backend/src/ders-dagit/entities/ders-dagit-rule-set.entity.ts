import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { DersDagitStudio } from './ders-dagit-studio.entity';

@Entity('ders_dagit_rule_set')
export class DersDagitRuleSet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'studio_id', type: 'uuid', unique: true })
  studio_id: string;

  @Column({ type: 'jsonb', default: {} })
  rules: Record<string, { active: boolean; weight?: number; params?: Record<string, unknown> }>;

  @Column({ name: 'building_travel', type: 'jsonb', default: [] })
  building_travel: unknown[];

  @Column({ name: 'planning_relations', type: 'jsonb', default: [] })
  planning_relations: unknown[];

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @ManyToOne(() => DersDagitStudio, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'studio_id' })
  studio: DersDagitStudio;
}
