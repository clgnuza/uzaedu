import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AgendaNote } from './agenda-note.entity';

@Entity('agenda_note_attachments')
export class AgendaNoteAttachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'note_id', type: 'uuid' })
  noteId: string;

  @Column({ name: 'file_url', length: 512 })
  fileUrl: string;

  @Column({ name: 'file_type', type: 'varchar', length: 64, nullable: true })
  fileType: string | null;

  @Column({ name: 'file_name', type: 'varchar', length: 255, nullable: true })
  fileName: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => AgendaNote, (n) => n.attachments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'note_id' })
  note: AgendaNote;
}
