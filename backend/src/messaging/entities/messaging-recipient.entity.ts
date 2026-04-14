import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type RecipientStatus = 'pending' | 'sent' | 'failed' | 'skipped';

@Entity('messaging_recipients')
export class MessagingRecipient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'campaign_id', type: 'uuid' })
  campaignId: string;

  @Column({ name: 'recipient_name', type: 'varchar', length: 255, nullable: true })
  recipientName: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone: string | null;

  @Column({ name: 'student_name', type: 'varchar', length: 255, nullable: true })
  studentName: string | null;

  @Column({ name: 'student_number', type: 'varchar', length: 50, nullable: true })
  studentNumber: string | null;

  @Column({ name: 'class_name', type: 'varchar', length: 50, nullable: true })
  className: string | null;

  @Column({ name: 'message_text', type: 'text', nullable: true })
  messageText: string | null;

  @Column({ name: 'file_path', type: 'text', nullable: true })
  filePath: string | null;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: RecipientStatus;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @Column({ name: 'error_msg', type: 'text', nullable: true })
  errorMsg: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
