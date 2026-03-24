import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('announcement_reads')
export class AnnouncementRead {
  @PrimaryColumn({ type: 'uuid' })
  user_id: string;

  @PrimaryColumn({ type: 'uuid' })
  announcement_id: string;

  @Column({ type: 'timestamptz' })
  read_at: Date;
}
