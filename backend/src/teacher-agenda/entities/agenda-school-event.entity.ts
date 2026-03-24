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
import { AgendaSchoolEventAssignment } from './agenda-school-event-assignment.entity';

@Entity('agenda_school_events')
export class AgendaSchoolEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @Column({ length: 512 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'event_at', type: 'timestamptz' })
  eventAt: Date;

  @Column({ name: 'event_type', type: 'varchar', length: 64, nullable: true })
  eventType: string | null;

  @Column({ name: 'target_audience', type: 'varchar', length: 32, nullable: true })
  targetAudience: string | null;

  @Column({ name: 'attachment_url', type: 'varchar', length: 512, nullable: true })
  attachmentUrl: string | null;

  @Column({ type: 'boolean', default: false })
  important: boolean;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @Column({ name: 'archived_at', type: 'timestamptz', nullable: true })
  archivedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school: School;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  creator: User | null;

  @OneToMany(() => AgendaSchoolEventAssignment, (a) => a.event)
  assignments: AgendaSchoolEventAssignment[];
}
