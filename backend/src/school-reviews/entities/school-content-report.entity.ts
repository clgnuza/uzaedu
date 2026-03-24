import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

/** Uygunsuz içerik bildirimi. Yorum, soru veya cevap için. */
@Entity('school_content_reports')
export class SchoolContentReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** 'review' | 'question' | 'answer' */
  @Column({ type: 'varchar', length: 16 })
  entity_type: 'review' | 'question' | 'answer';

  @Column({ type: 'uuid' })
  entity_id: string;

  /** "u:{userId}" veya "a:{anonymousId}" */
  @Column({ type: 'varchar', length: 256 })
  reporter_actor_key: string;

  @Column({ type: 'uuid', nullable: true })
  reporter_user_id: string | null;

  /** Örn: spam, uygunsuz, yanlis_bilgi, diger */
  @Column({ type: 'varchar', length: 64, default: 'diger' })
  reason: string;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @CreateDateColumn()
  created_at: Date;
}
