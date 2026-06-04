import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('push_subscriptions')
@Unique(['user_id', 'endpoint'])
export class PushSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'text' })
  endpoint: string;

  @Column({ type: 'text' })
  p256dh: string;

  @Column({ type: 'text' })
  auth: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  user_agent: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
