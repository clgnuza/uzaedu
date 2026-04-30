import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { School } from '../../schools/entities/school.entity';
import { SchoolClass } from '../../classes-subjects/entities/school-class.entity';

@Entity('students')
export class Student {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @Column({ name: 'class_id', type: 'uuid', nullable: true })
  classId: string | null;

  @Column({ length: 255 })
  name: string;

  @Column({ name: 'student_number', type: 'varchar', length: 64, nullable: true })
  studentNumber: string | null;

  @Column({ name: 'first_name', type: 'varchar', length: 128, nullable: true })
  firstName: string | null;

  @Column({ name: 'last_name', type: 'varchar', length: 128, nullable: true })
  lastName: string | null;

  @Column({ name: 'gender', type: 'varchar', length: 16, nullable: true })
  gender: string | null;

  @Column({ name: 'birth_date', type: 'date', nullable: true })
  birthDate: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school: School;

  @ManyToOne(() => SchoolClass, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'class_id' })
  schoolClass: SchoolClass | null;
}
