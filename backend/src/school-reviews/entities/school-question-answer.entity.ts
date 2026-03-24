import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { SchoolQuestion } from './school-question.entity';
import { User } from '../../users/entities/user.entity';

/** Soruya verilen cevap. Başka kullanıcılar (öğretmenler) soruya cevap verebilir. */
@Entity('school_question_answers')
export class SchoolQuestionAnswer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  question_id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'text' })
  answer: string;

  /** İsmim gizli kalsın (anonim gösterim) */
  @Column({ type: 'boolean', default: false })
  is_anonymous: boolean;

  @Column({ type: 'varchar', length: 32, default: 'approved' })
  status: 'pending' | 'approved' | 'hidden';

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => SchoolQuestion, (q) => q.answers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'question_id' })
  question: SchoolQuestion;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
