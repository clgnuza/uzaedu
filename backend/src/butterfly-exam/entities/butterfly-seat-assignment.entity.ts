import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Student } from '../../students/entities/student.entity';
import { ButterflyExamPlan } from './butterfly-exam-plan.entity';
import { ButterflyRoom } from './butterfly-room.entity';

@Entity('butterfly_seat_assignments')
@Index(['planId'])
@Index(['studentId'])
export class ButterflySeatAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'plan_id', type: 'uuid' })
  planId: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @Column({ name: 'room_id', type: 'uuid' })
  roomId: string;

  @Column({ name: 'seat_index', type: 'int' })
  seatIndex: number;

  @Column({ type: 'boolean', default: false })
  locked: boolean;

  @Column({ name: 'is_manual', type: 'boolean', default: false })
  isManual: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => ButterflyExamPlan, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'plan_id' })
  plan: ButterflyExamPlan;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @ManyToOne(() => ButterflyRoom, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'room_id' })
  room: ButterflyRoom;
}
