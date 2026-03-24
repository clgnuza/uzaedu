import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { School } from '../../schools/entities/school.entity';

/** Devamsızlık tipi: raporlu, izinli, gelmeyen */
export type AbsenceType = 'raporlu' | 'izinli' | 'gelmeyen';

@Entity('duty_absence')
export class DutyAbsence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'school_id', type: 'uuid' })
  school_id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  user_id: string;

  @Column({ name: 'date_from', type: 'date' })
  date_from: string;

  @Column({ name: 'date_to', type: 'date' })
  date_to: string;

  @Column({ name: 'absence_type', type: 'varchar', length: 32 })
  absence_type: AbsenceType;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  created_by: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => School)
  @JoinColumn({ name: 'school_id' })
  school: School;
}
