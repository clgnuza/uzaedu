import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';


@Entity('duty_log')
export class DutyLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'school_id', type: 'uuid' })
  school_id: string;

  /** publish | reassign | absent_marked */
  @Column({ type: 'varchar', length: 32 })
  action: string;

  @Column({ name: 'duty_slot_id', type: 'uuid', nullable: true })
  duty_slot_id: string | null;

  /** Yayın / plandaki işlemler için (slot silindikten sonra da satır kalır) */
  @Column({ name: 'duty_plan_id', type: 'uuid', nullable: true })
  duty_plan_id: string | null;

  @Column({ name: 'old_user_id', type: 'uuid', nullable: true })
  old_user_id: string | null;

  @Column({ name: 'new_user_id', type: 'uuid', nullable: true })
  new_user_id: string | null;

  @Column({ name: 'performed_by', type: 'uuid' })
  performed_by: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @Column({ name: 'undone_at', type: 'timestamptz', nullable: true })
  undone_at: Date | null;

  @Column({ name: 'undone_by', type: 'uuid', nullable: true })
  undone_by: string | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'performed_by' })
  performedByUser: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'old_user_id' })
  oldUser: User | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'new_user_id' })
  newUser: User | null;
}
