import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { TeacherPersonalProgram } from './teacher-personal-program.entity';

@Entity('teacher_personal_program_entry')
export class TeacherPersonalProgramEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'program_id', type: 'uuid' })
  program_id: string;

  @Column({ name: 'day_of_week', type: 'smallint' })
  day_of_week: number;

  @Column({ name: 'lesson_num', type: 'smallint' })
  lesson_num: number;

  @Column({ name: 'class_section', type: 'varchar', length: 32 })
  class_section: string;

  @Column({ type: 'varchar', length: 128 })
  subject: string;

  @ManyToOne(() => TeacherPersonalProgram, (p) => p.entries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'program_id' })
  program: TeacherPersonalProgram;
}
