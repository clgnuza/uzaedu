import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('messaging_delivery_events')
export class MessagingDeliveryEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @Column({ name: 'campaign_id', type: 'uuid', nullable: true })
  campaignId: string | null;

  @Column({ name: 'recipient_id', type: 'uuid', nullable: true })
  recipientId: string | null;

  @Column({ type: 'varchar', length: 20 })
  provider: string;

  @Column({ name: 'external_message_id', type: 'varchar', length: 128, nullable: true })
  externalMessageId: string | null;

  @Column({ type: 'varchar', length: 20 })
  status: string;

  @Column({ name: 'raw_payload', type: 'jsonb', default: {} })
  rawPayload: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
