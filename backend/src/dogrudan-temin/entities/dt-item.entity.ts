import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('dt_items')
export class DtItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @Column({ name: 'dt_file_id', type: 'uuid' })
  dtFileId: string;

  @Column({ type: 'varchar', length: 512 })
  name: string;

  @Column({ type: 'text', nullable: true })
  spec: string | null;

  @Column({ type: 'numeric', precision: 14, scale: 6, default: 1 })
  qty: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  unit: string | null;

  @Column({ name: 'vat_rate', type: 'int', default: 20 })
  vatRate: number;

  @Column({ name: 'estimated_unit_price', type: 'numeric', precision: 14, scale: 6, nullable: true })
  estimatedUnitPrice: string | null;

  @Column({ name: 'estimated_total', type: 'numeric', precision: 14, scale: 6, nullable: true })
  estimatedTotal: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

