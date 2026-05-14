import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('dt_acceptance_commission')
export class DtAcceptanceCommission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @Column({ name: 'dt_file_id', type: 'uuid' })
  dtFileId: string;

  @Column({ type: 'varchar', length: 32, default: 'muayene_kabul' })
  kind: string;

  @Column({ name: 'chairman_user_id', type: 'uuid', nullable: true })
  chairmanUserId: string | null;

  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
