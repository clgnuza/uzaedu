import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { DersDagitProgram } from './ders-dagit-program.entity';

@Entity('ders_dagit_program_entry')
export class DersDagitProgramEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'program_id', type: 'uuid' })
  program_id: string;

  @Column({ name: 'assignment_id', type: 'uuid', nullable: true })
  assignment_id: string | null;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  user_id: string | null;

  @Column({ name: 'day_of_week', type: 'int' })
  day_of_week: number;

  @Column({ name: 'lesson_num', type: 'int' })
  lesson_num: number;

  @Column({ name: 'class_section', type: 'varchar', length: 64 })
  class_section: string;

  @Column({ type: 'varchar', length: 128 })
  subject: string;

  @Column({ name: 'room_id', type: 'uuid', nullable: true })
  room_id: string | null;

  @Column({ name: 'is_locked', type: 'boolean', default: false })
  is_locked: boolean;

  @Column({ name: 'group_id', type: 'uuid', nullable: true })
  group_id: string | null;

  @ManyToOne(() => DersDagitProgram, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'program_id' })
  program: DersDagitProgram;
}
