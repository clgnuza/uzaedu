import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('messaging_contact_preferences')
export class MessagingContactPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @Column({ type: 'varchar', length: 30 })
  phone: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name: string | null;

  @Column({ name: 'preferred_channel', type: 'varchar', length: 10, default: 'whatsapp' })
  preferredChannel: 'whatsapp' | 'sms';

  @Column({ name: 'no_sms', type: 'boolean', default: false })
  noSms: boolean;

  @Column({ name: 'no_whatsapp', type: 'boolean', default: false })
  noWhatsapp: boolean;

  @Column({ name: 'quiet_hours_note', type: 'varchar', length: 255, nullable: true })
  quietHoursNote: string | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
