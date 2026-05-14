import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('dt_file_document_registry')
@Index(['dtFileId'])
export class DtFileDocumentRegistry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @Column({ name: 'dt_file_id', type: 'uuid' })
  dtFileId: string;

  @Column({ type: 'varchar', length: 64 })
  stage: string;

  @Column({ name: 'doc_date', type: 'date', nullable: true })
  docDate: string | null;

  @Column({ name: 'number_prefix', type: 'varchar', length: 256, nullable: true })
  numberPrefix: string | null;

  @Column({ name: 'number_suffix', type: 'varchar', length: 128, nullable: true })
  numberSuffix: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  meta: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
