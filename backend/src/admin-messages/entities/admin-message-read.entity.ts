import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { AdminMessage } from './admin-message.entity';
import { User } from '../../users/entities/user.entity';

@Entity('admin_message_reads')
export class AdminMessageRead {
  @PrimaryColumn({ type: 'uuid' })
  message_id: string;

  @PrimaryColumn({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'timestamptz' })
  read_at: Date;

  @ManyToOne(() => AdminMessage, (m) => m.reads, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'message_id' })
  message: AdminMessage;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
