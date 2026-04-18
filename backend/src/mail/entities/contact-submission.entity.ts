import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export type ContactSubmissionStatus = 'new' | 'replied' | 'archived';

@Entity('contact_submissions')
export class ContactSubmission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 200 })
  subject: string;

  @Column({ type: 'text' })
  message: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  first_read_at: Date | null;

  @Column({ type: 'varchar', length: 20, default: 'new' })
  status: ContactSubmissionStatus;

  @Column({ type: 'text', nullable: true })
  reply_body: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reply_sent_at: Date | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'replied_by_user_id' })
  replied_by: User | null;

  @Column({ type: 'boolean', default: false })
  notify_email_sent: boolean;
}
