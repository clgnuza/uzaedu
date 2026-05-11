import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { School } from '../../schools/entities/school.entity';

@Entity('school_subjects')
export class SchoolSubject {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'school_id', type: 'uuid', nullable: true })
  schoolId: string | null;

  @Column({ name: 'owner_user_id', type: 'uuid', nullable: true })
  ownerUserId: string | null;

  @Column({ type: 'varchar', length: 128 })
  name: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  code: string | null;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => School, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'school_id' })
  school: School | null;
}
