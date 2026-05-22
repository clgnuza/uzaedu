import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('ders_dagit_building')
export class DersDagitBuilding {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'school_id', type: 'uuid' })
  school_id: string;

  @Column({ type: 'varchar', length: 128 })
  name: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sort_order: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
