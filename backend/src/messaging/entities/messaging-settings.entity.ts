import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('messaging_settings')
export class MessagingSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'school_id', type: 'uuid', unique: true })
  schoolId: string;

  @Column({ type: 'varchar', length: 30, default: 'mock' })
  provider: 'mock' | 'meta' | 'twilio' | 'netgsm' | 'custom';

  @Column({ name: 'api_key', type: 'text', nullable: true })
  apiKey: string | null;

  @Column({ name: 'api_secret', type: 'text', nullable: true })
  apiSecret: string | null;

  @Column({ name: 'phone_number_id', type: 'text', nullable: true })
  phoneNumberId: string | null;

  @Column({ name: 'from_number', type: 'varchar', length: 30, nullable: true })
  fromNumber: string | null;

  @Column({ name: 'api_endpoint', type: 'text', nullable: true })
  apiEndpoint: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: false })
  isActive: boolean;

  @Column({ name: 'extra_config', type: 'jsonb', default: '{}' })
  extraConfig: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
