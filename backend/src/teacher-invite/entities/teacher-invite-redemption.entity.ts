import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { TeacherInviteCode } from './teacher-invite-code.entity';

@Entity('teacher_invite_redemptions')
@Index(['inviteeUserId'], { unique: true })
@Index(['inviteCodeId', 'createdAt'])
export class TeacherInviteRedemption {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'invite_code_id', type: 'uuid' })
  inviteCodeId: string;

  @ManyToOne(() => TeacherInviteCode, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invite_code_id' })
  inviteCode: TeacherInviteCode;

  @Column({ name: 'invitee_user_id', type: 'uuid' })
  inviteeUserId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invitee_user_id' })
  invitee: User;

  @Column({ name: 'invitee_jeton', type: 'numeric', precision: 14, scale: 6, default: 0 })
  inviteeJeton: string;

  @Column({ name: 'inviter_jeton', type: 'numeric', precision: 14, scale: 6, default: 0 })
  inviterJeton: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
