import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type CampaignType = 'toplu_mesaj' | 'ek_ders' | 'maas' | 'devamsizlik' | 'ders_devamsizlik' | 'devamsizlik_mektup' | 'karne' | 'ara_karne' | 'izin' | 'veli_toplantisi' | 'davetiye' | 'grup_mesaj' | 'mebbis_puantaj' | 'ek_ders_bordro' | 'maas_bordro';
export type CampaignStatus = 'draft' | 'preview' | 'sending' | 'completed' | 'failed' | 'cancelled';

@Entity('messaging_campaigns')
export class MessagingCampaign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ type: 'varchar', length: 40 })
  type: CampaignType;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status: CampaignStatus;

  @Column({ name: 'total_count', type: 'int', default: 0 })
  totalCount: number;

  @Column({ name: 'sent_count', type: 'int', default: 0 })
  sentCount: number;

  @Column({ name: 'failed_count', type: 'int', default: 0 })
  failedCount: number;

  @Column({ name: 'file_path', type: 'text', nullable: true })
  filePath: string | null;

  @Column({ type: 'jsonb', default: '{}' })
  metadata: Record<string, unknown>;

  @Column({ name: 'attachment_path', type: 'text', nullable: true })
  attachmentPath: string | null;

  @Column({ name: 'attachment_name', type: 'varchar', length: 255, nullable: true })
  attachmentName: string | null;

  @Column({ name: 'send_to_group_id', type: 'uuid', nullable: true })
  sendToGroupId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
