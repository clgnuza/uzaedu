import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ButterflyExamPlan } from './butterfly-exam-plan.entity';
import { ButterflyRoom } from './butterfly-room.entity';

@Entity('butterfly_exam_proctors')
@Unique(['planId', 'roomId', 'userId'])
@Index(['planId'])
export class ButterflyExamProctor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'plan_id', type: 'uuid' })
  planId: string;

  @Column({ name: 'room_id', type: 'uuid' })
  roomId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  label: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => ButterflyExamPlan, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'plan_id' })
  plan: ButterflyExamPlan;

  @ManyToOne(() => ButterflyRoom, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'room_id' })
  room: ButterflyRoom;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
