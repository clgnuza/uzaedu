import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { DersDagitAssignment } from './ders-dagit-assignment.entity';
import { User } from '../../users/entities/user.entity';

@Entity('ders_dagit_assignment_teacher')
export class DersDagitAssignmentTeacher {
  @PrimaryColumn({ name: 'assignment_id', type: 'uuid' })
  assignment_id: string;

  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  user_id: string;

  @ManyToOne(() => DersDagitAssignment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assignment_id' })
  assignment: DersDagitAssignment;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
