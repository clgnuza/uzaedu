import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { School } from '../../schools/entities/school.entity';
import { BilsemCalendarItem } from './bilsem-calendar-item.entity';
import { User } from '../../users/entities/user.entity';

export type BilsemGorevTipi = 'sorumlu' | 'yardimci';

@Entity('bilsem_calendar_assignment')
export class BilsemCalendarAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school: School;

  @Column({ name: 'bilsem_calendar_item_id', type: 'uuid' })
  bilsemCalendarItemId: string;

  @ManyToOne(() => BilsemCalendarItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bilsem_calendar_item_id' })
  bilsemCalendarItem: BilsemCalendarItem;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'gorev_tipi', type: 'varchar', length: 32, default: 'sorumlu' })
  gorevTipi: BilsemGorevTipi;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;
}
