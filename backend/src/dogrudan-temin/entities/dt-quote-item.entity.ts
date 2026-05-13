import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('dt_quote_items')
export class DtQuoteItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @Column({ name: 'quote_id', type: 'uuid' })
  quoteId: string;

  @Column({ name: 'dt_item_id', type: 'uuid' })
  dtItemId: string;

  @Column({ name: 'unit_price', type: 'numeric', precision: 14, scale: 6 })
  unitPrice: string;

  @Column({ type: 'numeric', precision: 14, scale: 6, nullable: true })
  total: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

