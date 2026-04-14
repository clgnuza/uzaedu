import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { School } from '../../schools/entities/school.entity';
import { SmartBoardDevice } from './smart-board-device.entity';
import { User } from '../../users/entities/user.entity';

@Entity('tv_classroom_usb_tokens')
export class TvClassroomUsbToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64 })
  token_hash: string;

  @Column({ type: 'uuid' })
  school_id: string;

  @Column({ type: 'uuid' })
  device_id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'timestamptz' })
  expires_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school: School;

  @ManyToOne(() => SmartBoardDevice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'device_id' })
  device: SmartBoardDevice;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
