import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { School } from '../../schools/entities/school.entity';
import { ButterflyBuilding } from './butterfly-building.entity';

@Entity('butterfly_rooms')
@Index(['schoolId'])
@Index(['buildingId', 'sortOrder'])
export class ButterflyRoom {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @Column({ name: 'building_id', type: 'uuid' })
  buildingId: string;

  @Column({ type: 'varchar', length: 128 })
  name: string;

  @Column({ type: 'int' })
  capacity: number;

  @Column({ name: 'seat_layout', type: 'text', default: 'pair' })
  seatLayout: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school: School;

  @ManyToOne(() => ButterflyBuilding, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'building_id' })
  building: ButterflyBuilding;
}
