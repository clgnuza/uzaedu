import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { School } from '../../schools/entities/school.entity';

@Entity('smart_board_devices')
export class SmartBoardDevice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  school_id: string;

  @Column({ type: 'varchar', length: 16 })
  pairing_code: string;

  @Column({ type: 'varchar', length: 128, default: 'Akıllı Tahta' })
  name: string;

  @Column({ name: 'room_or_location', type: 'varchar', length: 128, nullable: true })
  roomOrLocation: string | null;

  /** Sınıf (örn. 9-A). Ders programından otomatik slot almak için. */
  @Column({ name: 'class_section', type: 'varchar', length: 32, nullable: true })
  classSection: string | null;

  @Column({ type: 'varchar', length: 16, default: 'offline' })
  status: string;

  @Column({ type: 'timestamptz', nullable: true })
  last_seen_at: Date | null;

  /** Kroki plan üzerinde X konumu (0–100 yüzde). */
  @Column({ name: 'plan_position_x', type: 'decimal', precision: 5, scale: 2, nullable: true })
  planPositionX: number | null;

  /** Kroki plan üzerinde Y konumu (0–100 yüzde). */
  @Column({ name: 'plan_position_y', type: 'decimal', precision: 5, scale: 2, nullable: true })
  planPositionY: number | null;

  /** Hangi kat planında (0-based indeks). smart_board_floor_plans dizisine göre. */
  @Column({ name: 'plan_floor_index', type: 'int', default: 0 })
  planFloorIndex: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school: School;
}
