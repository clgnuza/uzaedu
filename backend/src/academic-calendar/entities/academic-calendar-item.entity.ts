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
import { SchoolType } from '../../types/enums';

export type AcademicCalendarItemType = 'belirli_gun_hafta' | 'ogretmen_isleri';

@Entity('academic_calendar_item')
export class AcademicCalendarItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'week_id', type: 'uuid' })
  weekId: string;

  @ManyToOne(() => WorkCalendar, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'week_id' })
  workCalendar: WorkCalendar;

  @Column({ name: 'item_type', type: 'varchar', length: 32 })
  itemType: AcademicCalendarItemType;

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

  /** null veya boş = tüm kurum türleri; aksi halde yalnızca listelenen türler */
  @Column({ name: 'school_types', type: 'jsonb', nullable: true })
  schoolTypes: SchoolType[] | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
