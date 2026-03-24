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

@Entity('optik_usage_log')
export class OptikUsageLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'school_id', type: 'uuid', nullable: true })
  schoolId: string | null;

  @ManyToOne(() => School, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'school_id' })
  school: School | null;

  @Column({ name: 'usage_type', length: 16 })
  usageType: 'ocr' | 'grade';

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
