import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { ContentItem } from './content-item.entity';
import { ContentChannel } from './content-channel.entity';

@Entity('content_sources')
export class ContentSource {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  key: string;

  @Column({ type: 'varchar', length: 128 })
  label: string;

  @Column({ name: 'base_url', type: 'varchar', length: 512, nullable: true })
  baseUrl: string | null;

  @Column({ name: 'rss_url', type: 'varchar', length: 512, nullable: true })
  rssUrl: string | null;

  /** Kaynak başına max RSS item (il MEB için 10; null = global limit) */
  @Column({ name: 'rss_item_limit', type: 'int', nullable: true })
  rssItemLimit: number | null;

  @Column({ name: 'scrape_config', type: 'jsonb', nullable: true })
  scrapeConfig: Record<string, unknown> | null;

  @Column({ name: 'sync_interval_minutes', type: 'int', default: 120 })
  syncIntervalMinutes: number;

  @Column({ name: 'last_synced_at', type: 'timestamptz', nullable: true })
  lastSyncedAt: Date | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => ContentItem, (item) => item.source)
  items: ContentItem[];

  @ManyToMany(() => ContentChannel, (ch) => ch.sources)
  channels: ContentChannel[];
}
