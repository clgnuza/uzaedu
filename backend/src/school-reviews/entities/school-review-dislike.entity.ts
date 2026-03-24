import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { SchoolReview } from './school-review.entity';
import { User } from '../../users/entities/user.entity';

/** Değerlendirmeye verilen beğenmeme. Girişli: user_id. Anonim: actor_key. */
@Entity('school_review_dislikes')
@Unique(['review_id', 'actor_key'])
export class SchoolReviewDislike {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  review_id: string;

  @Column({ type: 'varchar', length: 256 })
  actor_key: string;

  @Column({ type: 'uuid', nullable: true })
  user_id: string | null;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => SchoolReview, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'review_id' })
  review: SchoolReview;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;
}
