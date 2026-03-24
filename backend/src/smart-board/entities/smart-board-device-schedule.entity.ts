import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { SmartBoardDevice } from './smart-board-device.entity';
import { User } from '../../users/entities/user.entity';

@Entity('smart_board_device_schedule')
export class SmartBoardDeviceSchedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'device_id', type: 'uuid' })
  device_id: string;

  @Column({ name: 'day_of_week', type: 'smallint' })
  day_of_week: number;

  @Column({ name: 'lesson_num', type: 'smallint' })
  lesson_num: number;

  @Column({ name: 'user_id', type: 'uuid' })
  user_id: string;

  @Column({ type: 'varchar', length: 128 })
  subject: string;

  @Column({ name: 'class_section', type: 'varchar', length: 32, nullable: true })
  class_section: string | null;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => SmartBoardDevice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'device_id' })
  device: SmartBoardDevice;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
