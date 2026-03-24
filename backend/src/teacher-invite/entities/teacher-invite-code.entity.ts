import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('teacher_invite_codes')
@Index(['inviterUserId'], { unique: true })
@Index(['code'], { unique: true })
export class TeacherInviteCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'inviter_user_id', type: 'uuid' })
  inviterUserId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inviter_user_id' })
  inviter: User;

  /** Büyük harf + rakam, benzersiz */
  @Column({ type: 'varchar', length: 16 })
  code: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
