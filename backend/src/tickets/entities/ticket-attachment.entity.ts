import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { TicketMessage } from './ticket-message.entity';

@Entity('ticket_attachments')
export class TicketAttachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  ticket_message_id: string;

  @Column({ name: 'storage_key', length: 512 })
  storage_key: string;

  @Column({ length: 256 })
  filename: string;

  @Column({ name: 'mime_type', length: 64 })
  mime_type: string;

  @Column({ name: 'size_bytes', type: 'int' })
  size_bytes: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @ManyToOne(() => TicketMessage, (m) => m.attachments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticket_message_id' })
  message: TicketMessage;
}
