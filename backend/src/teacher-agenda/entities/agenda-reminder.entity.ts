import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AgendaNote } from './agenda-note.entity';
import { AgendaTask } from './agenda-task.entity';

@Entity('agenda_reminders')
export class AgendaReminder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'note_id', type: 'uuid', nullable: true })
  noteId: string | null;

  @Column({ name: 'task_id', type: 'uuid', nullable: true })
  taskId: string | null;

  @Column({ name: 'remind_at', type: 'timestamptz' })
  remindAt: Date;

  @Column({ name: 'repeat_rule', type: 'varchar', length: 32, nullable: true })
  repeatRule: string | null;

  @Column({ name: 'push_sent', type: 'boolean', default: false })
  pushSent: boolean;

  @Column({ name: 'silent_until', type: 'timestamptz', nullable: true })
  silentUntil: Date | null;

  @Column({ name: 'snooze_count', type: 'int', default: 0 })
  snoozeCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => AgendaNote, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'note_id' })
  note: AgendaNote | null;

  @ManyToOne(() => AgendaTask, (t) => t.reminders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task: AgendaTask | null;
}
