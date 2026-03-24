import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { School } from '../../schools/entities/school.entity';
import { User } from '../../users/entities/user.entity';
import { SchoolQuestionAnswer } from './school-question-answer.entity';

/** Okula sorulan soru. Kullanıcılar okul hakkında soru sorabilir. */
@Entity('school_questions')
export class SchoolQuestion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  school_id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'text' })
  question: string;

  /** İsmim gizli kalsın (anonim gösterim) */
  @Column({ type: 'boolean', default: false })
  is_anonymous: boolean;

  /**
   * Durum: pending = moderasyonda, approved = yayında, hidden = gizlendi.
   */
  @Column({ type: 'varchar', length: 32, default: 'approved' })
  status: 'pending' | 'approved' | 'hidden';

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school: School;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => SchoolQuestionAnswer, (a) => a.question)
  answers: SchoolQuestionAnswer[];
}
