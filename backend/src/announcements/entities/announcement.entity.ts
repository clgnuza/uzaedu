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

@Entity('announcements')
export class Announcement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  school_id: string;

  @Column({ length: 255 })
  title: string;

  /**
   * Kısa özet; Duyuru TV ve listelerde kullanılabilir.
   */
  @Column({ type: 'text', nullable: true })
  summary: string | null;

  @Column({ type: 'text', nullable: true })
  body: string | null;

  /**
   * Önem seviyesi: normal | high | urgent (veya benzeri).
   */
  @Column({ type: 'varchar', length: 32, default: 'normal' })
  importance: string;

  /**
   * İçerik tipi; Duyuru TV ekranı için segmentasyon.
   *
   * Örnekler:
   * - general
   * - special_day (Belirli Gün ve Haftalar)
   * - principal_message (Okul müdürü mesajı)
   * - staff (Öğretmenlerimiz)
   * - info_bank (Bilgi bankası yazıları)
   * - birthday
   * - success
   * - timetable (Ders programı bloğu)
   * - duty (Nöbetçi listesi)
   * - meal (Yemek listesi)
   * - ticker (alt haber bandı)
   * - weather, countdown, now_in_class, ...
   */
  @Column({ type: 'varchar', length: 64, default: 'general' })
  category: string;

  /**
   * Bu duyuru/ içerik Duyuru TV ekranında gösterilsin mi?
   */
  @Column({ type: 'boolean', default: false })
  show_on_tv: boolean;

  /**
   * Duyuru TV hedef ekranı:
   * - all: Tüm ekranlar (koridor + öğretmenler + tahta)
   * - both: Koridor + öğretmenler odası
   * - corridor: Sadece koridor
   * - teachers: Sadece öğretmenler odası
   * - classroom: Sadece Akıllı Tahta
   */
  @Column({ type: 'varchar', length: 16, default: 'both' })
  tv_audience: string;

  /**
   * TV ekranında konum (opsiyonel ipucu): middle | bottom | right | ticker vb.
   * Layout motoru için rehber; zorunlu değil.
   */
  @Column({ type: 'varchar', length: 32, nullable: true })
  tv_slot: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  published_at: Date | null;

  /**
   * Acil duyuru: Bu tarihe kadar tüm TV ekranlarında override olarak gösterilir.
   */
  @Column({ type: 'timestamptz', nullable: true })
  urgent_override_until: Date | null;

  /**
   * TV slayt süresi (saniye). Boşsa school.tv_default_slide_duration veya varsayılan kullanılır.
   */
  @Column({ type: 'int', nullable: true })
  tv_slide_duration_seconds: number | null;

  /**
   * Zamanlanmış gösterim başlangıcı. Boşsa hemen gösterilir.
   */
  @Column({ type: 'timestamptz', nullable: true })
  scheduled_from: Date | null;

  /**
   * Zamanlanmış gösterim bitişi. Boşsa süresiz.
   */
  @Column({ type: 'timestamptz', nullable: true })
  scheduled_until: Date | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  attachment_url: string | null;

  /**
   * YouTube embed URL (örn. https://www.youtube.com/watch?v=xxx veya https://youtu.be/xxx).
   * TV ekranında video slaytı için kullanılır.
   */
  @Column({ type: 'varchar', length: 512, nullable: true })
  youtube_url: string | null;

  /**
   * Video slaytı: true ise slayt video bitene kadar ilerlemez.
   */
  @Column({ type: 'boolean', default: false })
  tv_wait_for_video_end: boolean;

  @Column({ type: 'uuid' })
  created_by: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school: School;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  creator: User | null;
}
