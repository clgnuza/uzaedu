import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { School } from '../../schools/entities/school.entity';
import { SmartBoardDevice } from './smart-board-device.entity';
import { User } from '../../users/entities/user.entity';

@Entity('smart_board_qr_sessions')
export class SmartBoardQrSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  school_id: string;

  @Column({ type: 'uuid' })
  device_id: string;

  @Column({ type: 'varchar', length: 12 })
  code: string;

  @Column({ type: 'timestamptz' })
  expires_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  claimed_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  claimed_user_id: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  issued_usb_token_hash: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  issued_usb_token_plain: string | null;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school: School;

  @ManyToOne(() => SmartBoardDevice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'device_id' })
  device: SmartBoardDevice;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'claimed_user_id' })
  claimed_user: User | null;
}
