import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { DersDagitStudio } from './ders-dagit-studio.entity';
import { User } from '../../users/entities/user.entity';

@Entity('ders_dagit_preference')
export class DersDagitPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'studio_id', type: 'uuid' })
  studio_id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  user_id: string;

  @Column({ name: 'day_of_week', type: 'int' })
  day_of_week: number;

  @Column({ name: 'lesson_num', type: 'int', nullable: true })
  lesson_num: number | null;

  @Column({ type: 'varchar', length: 32, default: 'unavailable' })
  status: string;

  @Column({ name: 'is_hard', type: 'boolean', default: true })
  is_hard: boolean;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @ManyToOne(() => DersDagitStudio, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'studio_id' })
  studio: DersDagitStudio;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
