import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { SchoolQuestion } from './school-question.entity';
import { User } from '../../users/entities/user.entity';

/** Soruya verilen beğenmeme. */
@Entity('school_question_dislikes')
@Unique(['question_id', 'actor_key'])
export class SchoolQuestionDislike {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  question_id: string;

  @Column({ type: 'varchar', length: 256 })
  actor_key: string;

  @Column({ type: 'uuid', nullable: true })
  user_id: string | null;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => SchoolQuestion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'question_id' })
  question: SchoolQuestion;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;
}
