import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type SubjectEntry = { subjectName: string; sessionId?: string | null };

@Entity('sorumluluk_students')
export class SorumlulukStudent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId: string;

  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @Column({ name: 'student_name', type: 'varchar', length: 255 })
  studentName: string;

  @Column({ name: 'student_number', type: 'varchar', length: 50, nullable: true })
  studentNumber: string | null;

  @Column({ name: 'class_name', type: 'varchar', length: 50, nullable: true })
  className: string | null;

  @Column({ type: 'jsonb', default: '[]' })
  subjects: SubjectEntry[];

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
