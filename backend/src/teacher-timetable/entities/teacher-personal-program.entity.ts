import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { School } from '../../schools/entities/school.entity';
import { User } from '../../users/entities/user.entity';
import { TeacherPersonalProgramEntry } from './teacher-personal-program-entry.entity';

@Entity('teacher_personal_program')
export class TeacherPersonalProgram {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'school_id', type: 'uuid' })
  school_id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  user_id: string;

  @Column({ type: 'varchar', length: 128 })
  name: string;

  @Column({ name: 'academic_year', type: 'varchar', length: 16 })
  academic_year: string;

  @Column({ type: 'varchar', length: 32, default: 'Tüm Yıl' })
  term: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school: School;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => TeacherPersonalProgramEntry, (e) => e.program)
  entries: TeacherPersonalProgramEntry[];
}
