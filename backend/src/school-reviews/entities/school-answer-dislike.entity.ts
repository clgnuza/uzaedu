import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { SchoolQuestionAnswer } from './school-question-answer.entity';
import { User } from '../../users/entities/user.entity';

/** Cevaba verilen beğenmeme. */
@Entity('school_answer_dislikes')
@Unique(['answer_id', 'actor_key'])
export class SchoolAnswerDislike {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  answer_id: string;

  @Column({ type: 'varchar', length: 256 })
  actor_key: string;

  @Column({ type: 'uuid', nullable: true })
  user_id: string | null;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => SchoolQuestionAnswer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'answer_id' })
  answer: SchoolQuestionAnswer;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;
}
