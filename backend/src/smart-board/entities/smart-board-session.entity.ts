import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { SmartBoardDevice } from './smart-board-device.entity';
import { User } from '../../users/entities/user.entity';

@Entity('smart_board_sessions')
export class SmartBoardSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  device_id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'timestamptz' })
  connected_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  disconnected_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  last_heartbeat_at: Date | null;

  @ManyToOne(() => SmartBoardDevice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'device_id' })
  device: SmartBoardDevice;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
