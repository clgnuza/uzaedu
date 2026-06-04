import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('notification_push_settings')
export class NotificationPushSettings {
  @PrimaryColumn({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'boolean', default: false })
  quiet_hours_enabled: boolean;

  /** Gece yarısından itibaren dakika (0–1439) */
  @Column({ type: 'smallint', default: 1320 })
  quiet_start_minutes: number;

  @Column({ type: 'smallint', default: 480 })
  quiet_end_minutes: number;

  @Column({ type: 'varchar', length: 64, default: 'Europe/Istanbul' })
  timezone: string;

  @Column({ type: 'boolean', default: true })
  sound_enabled: boolean;

  @Column({ type: 'boolean', default: true })
  vibration_enabled: boolean;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
