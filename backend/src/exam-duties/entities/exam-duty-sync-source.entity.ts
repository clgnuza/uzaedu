import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('exam_duty_sync_sources')
export class ExamDutySyncSource {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  key: string;

  @Column({ type: 'varchar', length: 128 })
  label: string;

  @Column({ name: 'category_slug', type: 'varchar', length: 32 })
  categorySlug: string;

  @Column({ name: 'rss_url', type: 'varchar', length: 1024, nullable: true })
  rssUrl: string | null;

  @Column({ name: 'base_url', type: 'varchar', length: 512, nullable: true })
  baseUrl: string | null;

  @Column({ name: 'scrape_config', type: 'jsonb', nullable: true })
  scrapeConfig: Record<string, unknown> | null;

  @Column({ name: 'title_keywords', type: 'text', nullable: true })
  titleKeywords: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'last_synced_at', type: 'timestamptz', nullable: true })
  lastSyncedAt: Date | null;

  @Column({ name: 'last_result_created', type: 'int', default: 0 })
  lastResultCreated: number;

  @Column({ name: 'last_result_skipped', type: 'int', default: 0 })
  lastResultSkipped: number;

  @Column({ name: 'last_result_error', type: 'text', nullable: true })
  lastResultError: string | null;

  @Column({ name: 'consecutive_error_count', type: 'int', default: 0 })
  consecutiveErrorCount: number;

  @Column({ name: 'last_processed_url', type: 'text', nullable: true })
  lastProcessedUrl: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
