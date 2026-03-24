import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { WorkCalendar } from '../../work-calendar/entities/work-calendar.entity';

export type BilsemCalendarItemType = 'belirli_gun_hafta' | 'dep' | 'tanilama' | 'diger';

@Entity('bilsem_calendar_item')
export class BilsemCalendarItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'week_id', type: 'uuid' })
  weekId: string;

  @ManyToOne(() => WorkCalendar, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'week_id' })
  workCalendar: WorkCalendar;

  @Column({ name: 'item_type', type: 'varchar', length: 32 })
  itemType: BilsemCalendarItemType;

  @Column({ type: 'varchar', length: 150 })
  title: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  path: string | null;

  @Column({ name: 'icon_key', type: 'varchar', length: 64, nullable: true })
  iconKey: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
