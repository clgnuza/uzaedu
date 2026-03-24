import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('notification_preferences')
export class NotificationPreference {
  @PrimaryColumn({ type: 'uuid' })
  user_id: string;

  @PrimaryColumn({ length: 64 })
  channel: string;

  @Column({ type: 'boolean', default: true })
  push_enabled: boolean;
}
