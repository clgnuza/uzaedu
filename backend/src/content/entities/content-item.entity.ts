import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ContentSource } from './content-source.entity';

@Entity('content_items')
export class ContentItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'source_id', type: 'uuid' })
  sourceId: string;

  /**
   * İçerik türü: news | announcement | competition | exam | project | event | document
   */
  @Column({ name: 'content_type', type: 'varchar', length: 64, default: 'announcement' })
  contentType: string;

  @Column({ type: 'varchar', length: 512 })
  title: string;

  @Column({ type: 'text', nullable: true })
  summary: string | null;

  @Column({ name: 'source_url', type: 'varchar', length: 1024 })
  sourceUrl: string;

  @Column({ name: 'image_url', type: 'varchar', length: 1024, nullable: true })
  imageUrl: string | null;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  /**
   * İl bazlı filtre – Öğretmen Haberleri kanalında kullanılır.
   * Null = tüm iller. Dolu = sadece o il.
   */
  @Column({ name: 'city_filter', type: 'varchar', length: 100, nullable: true })
  cityFilter: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => ContentSource, (s) => s.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'source_id' })
  source: ContentSource;
}
