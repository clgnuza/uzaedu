import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('ders_dagit_room')
export class DersDagitRoom {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'school_id', type: 'uuid' })
  school_id: string;

  @Column({ name: 'building_id', type: 'uuid', nullable: true })
  building_id: string | null;

  @Column({ type: 'varchar', length: 128 })
  name: string;

  @Column({ type: 'int', nullable: true })
  capacity: number | null;

  @Column({ type: 'jsonb', default: [] })
  features: string[];

  @Column({ name: 'allowed_subjects', type: 'jsonb', nullable: true })
  allowed_subjects: string[] | null;

  @Column({ name: 'allowed_class_sections', type: 'jsonb', nullable: true })
  allowed_class_sections: string[] | null;

  @Column({ name: 'allowed_teacher_ids', type: 'jsonb', nullable: true })
  allowed_teacher_ids: string[] | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sort_order: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
