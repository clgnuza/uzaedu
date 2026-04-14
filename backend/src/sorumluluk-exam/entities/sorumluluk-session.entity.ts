import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('sorumluluk_sessions')
export class SorumlulukSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId: string;

  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @Column({ name: 'subject_name', type: 'varchar', length: 255 })
  subjectName: string;

  @Column({ name: 'session_date', type: 'date' })
  sessionDate: string;

  @Column({ name: 'start_time', type: 'time' })
  startTime: string;

  @Column({ name: 'end_time', type: 'time' })
  endTime: string;

  @Column({ name: 'room_name', type: 'varchar', length: 100, nullable: true })
  roomName: string | null;

  @Column({ type: 'int', default: 30 })
  capacity: number;

  @Column({ name: 'session_type', type: 'varchar', length: 20, default: 'yazili' })
  sessionType: 'yazili' | 'uygulama' | 'mixed';

  @Column({ type: 'varchar', length: 20, default: 'planned' })
  status: 'planned' | 'active' | 'completed' | 'cancelled';

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
