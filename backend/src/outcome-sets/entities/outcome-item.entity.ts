import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { OutcomeSet } from './outcome-set.entity';

@Entity('outcome_item')
export class OutcomeItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'outcome_set_id', type: 'uuid' })
  outcomeSetId: string;

  @ManyToOne(() => OutcomeSet, (set) => set.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'outcome_set_id' })
  outcomeSet: OutcomeSet;

  @Column({ name: 'week_order', type: 'int', nullable: true })
  weekOrder: number | null;

  @Column({ type: 'varchar', length: 256, nullable: true })
  unite: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  code: string | null;

  @Column({ type: 'text' })
  description: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
