import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('messaging_inbound_messages')
export class MessagingInboundMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @Column({ type: 'varchar', length: 30 })
  phone: string;

  @Column({ name: 'sender_name', type: 'varchar', length: 255, nullable: true })
  senderName: string | null;

  @Column({ type: 'text', nullable: true })
  body: string | null;

  @Column({ type: 'varchar', length: 20, default: 'meta' })
  provider: string;

  @Column({ name: 'external_message_id', type: 'varchar', length: 128, nullable: true })
  externalMessageId: string | null;

  @Column({ name: 'message_type', type: 'varchar', length: 20, default: 'text' })
  messageType: string;

  @Column({ name: 'raw_payload', type: 'jsonb', default: {} })
  rawPayload: Record<string, unknown>;

  @Column({ name: 'staff_reply', type: 'text', nullable: true })
  staffReply: string | null;

  @Column({ name: 'staff_replied_at', type: 'timestamptz', nullable: true })
  staffRepliedAt: Date | null;

  @Column({ name: 'staff_user_id', type: 'uuid', nullable: true })
  staffUserId: string | null;

  @CreateDateColumn({ name: 'received_at' })
  receivedAt: Date;
}
