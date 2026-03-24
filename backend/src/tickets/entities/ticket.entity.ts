import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { School } from '../../schools/entities/school.entity';
import { User } from '../../users/entities/user.entity';
import { TicketModule } from './ticket-module.entity';
import { TicketMessage } from './ticket-message.entity';

export type TicketTargetType = 'SCHOOL_SUPPORT' | 'PLATFORM_SUPPORT';
export type TicketIssueType = 'BUG' | 'QUESTION' | 'REQUEST' | 'IMPROVEMENT';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_REQUESTER' | 'RESOLVED' | 'CLOSED';

@Entity('tickets')
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'ticket_number', length: 32, unique: true })
  ticket_number: string;

  @Column({ type: 'uuid' })
  school_id: string;

  @Column({ name: 'target_type', length: 24 })
  target_type: TicketTargetType;

  @Column({ type: 'uuid' })
  module_id: string;

  @Column({ name: 'issue_type', length: 24 })
  issue_type: TicketIssueType;

  @Column({ length: 16, default: 'MEDIUM' })
  priority: TicketPriority;

  @Column({ length: 24, default: 'OPEN' })
  status: TicketStatus;

  @Column({ length: 512 })
  subject: string;

  @Column({ type: 'uuid' })
  requester_user_id: string;

  @Column({ type: 'uuid' })
  created_by_user_id: string;

  @Column({ type: 'uuid', nullable: true })
  assigned_to_user_id: string | null;

  @Column({ name: 'last_activity_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  last_activity_at: Date;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolved_at: Date | null;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closed_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  escalated_from_ticket_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  escalated_to_ticket_id: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school: School;

  @ManyToOne(() => TicketModule, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'module_id' })
  module: TicketModule;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requester_user_id' })
  requester: User;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'created_by_user_id' })
  createdBy: User;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'assigned_to_user_id' })
  assignedTo: User | null;

  @ManyToOne(() => Ticket, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'escalated_from_ticket_id' })
  escalatedFrom: Ticket | null;

  @ManyToOne(() => Ticket, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'escalated_to_ticket_id' })
  escalatedTo: Ticket | null;

  @OneToMany(() => TicketMessage, (m) => m.ticket)
  messages: TicketMessage[];
}
