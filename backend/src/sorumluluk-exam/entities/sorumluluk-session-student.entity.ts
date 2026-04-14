import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('sorumluluk_session_students')
export class SorumlulukSessionStudent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'session_id', type: 'uuid' })
  sessionId: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @Column({ name: 'attendance_status', type: 'varchar', length: 20, nullable: true })
  attendanceStatus: 'present' | 'absent' | 'excused' | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
