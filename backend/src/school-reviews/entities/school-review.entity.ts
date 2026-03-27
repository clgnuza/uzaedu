import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { School } from '../../schools/entities/school.entity';
import { User } from '../../users/entities/user.entity';

/** Okul değerlendirme/yorum. Öğretmenler okullara puan ve yorum yazabilir. */
@Entity('school_reviews')
export class SchoolReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  school_id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  /**
   * Genel puan (yapılandırılan aralık, varsayılan 1–10). Kriterler varsa ortalamadan hesaplanır; yoksa direkt.
   */
  @Column({ type: 'int' })
  rating: number;

  /**
   * Kriter bazlı puanlar. { slug: number } örn. { "sosyo_ekonomik": 4, "ulasim": 3 }
   * Boş/null ise sadece rating kullanılır.
   */
  @Column({ type: 'jsonb', nullable: true })
  criteria_ratings: Record<string, number> | null;

  /** İsmim gizli kalsın (anonim gösterim) */
  @Column({ type: 'boolean', default: false })
  is_anonymous: boolean;

  /** Yorum metni. Opsiyonel; sadece puan da verilebilir. */
  @Column({ type: 'text', nullable: true })
  comment: string | null;

  /**
   * Durum: pending = moderasyonda bekliyor, approved = yayında, hidden = superadmin gizledi.
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
}
