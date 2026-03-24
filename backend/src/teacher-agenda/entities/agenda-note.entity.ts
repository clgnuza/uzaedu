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
import { User } from '../../users/entities/user.entity';
import { School } from '../../schools/entities/school.entity';
import { AgendaNoteAttachment } from './agenda-note-attachment.entity';

export type AgendaNoteSource = 'PERSONAL' | 'SCHOOL' | 'PLATFORM';

@Entity('agenda_notes')
export class AgendaNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 512 })
  title: string;

  @Column({ type: 'text', nullable: true })
  body: string | null;

  @Column({ type: 'jsonb', nullable: true })
  tags: string[] | null;

  @Column({ name: 'subject_id', type: 'uuid', nullable: true })
  subjectId: string | null;

  @Column({ name: 'class_id', type: 'uuid', nullable: true })
  classId: string | null;

  @Column({ type: 'boolean', default: false })
  pinned: boolean;

  @Column({ type: 'varchar', length: 32, nullable: true })
  color: string | null;

  @Column({ type: 'varchar', length: 24 })
  source: AgendaNoteSource;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'school_id', type: 'uuid', nullable: true })
  schoolId: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ name: 'archived_at', type: 'timestamptz', nullable: true })
  archivedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school: School | null;

  @OneToMany(() => AgendaNoteAttachment, (a) => a.note)
  attachments: AgendaNoteAttachment[];
}
