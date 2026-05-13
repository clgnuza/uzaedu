import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('dt_generated_docs')
export class DtGeneratedDoc {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @Column({ name: 'dt_file_id', type: 'uuid', nullable: true })
  dtFileId: string | null;

  @Column({ name: 'doc_type', type: 'varchar', length: 64 })
  docType: string;

  @Column({ name: 'file_format', type: 'varchar', length: 16 })
  fileFormat: string;

  @Column({ name: 'storage_key', type: 'varchar', length: 512 })
  storageKey: string;

  @Column({ type: 'varchar', length: 255 })
  filename: string;

  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

