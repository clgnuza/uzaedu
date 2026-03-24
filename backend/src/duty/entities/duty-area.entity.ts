import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { School } from '../../schools/entities/school.entity';

@Entity('duty_area')
export class DutyArea {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'school_id', type: 'uuid' })
  school_id: string;

  @Column({ length: 128 })
  name: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sort_order: number;

  /** Bu nöbet yerine günlük kaç nöbetçi atanacak (otomatik planlama). Varsayılan: 1. */
  @Column({ name: 'slots_required', type: 'int', default: 1 })
  slotsRequired: number;

  @ManyToOne(() => School)
  @JoinColumn({ name: 'school_id' })
  school: School;
}
