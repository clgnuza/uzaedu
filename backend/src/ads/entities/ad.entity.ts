import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  AfterLoad,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export type AdPlatform = 'web' | 'ios' | 'android';

/** contextual: çerez/ATT gerekmez; targeting: istemci targeting_allowed (+ web çerez) ile sınırlı */
export type AdConsentMode = 'contextual' | 'targeting';

/** AdSense = web envanteri; AdMob = iOS/Android SDK; custom = ev / üçüncü parti */
export type AdProvider = 'adsense' | 'admob' | 'custom';

/** Web tarayıcı: mobil / masaüstü ayrımı (AdSense responsive slot eşlemesi) */
export type WebSurface = 'desktop' | 'mobile' | 'all';

@Entity('ads')
export class Ad {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 16 })
  platform: AdPlatform;

  @Column({ type: 'varchar', length: 16, default: 'custom' })
  ad_provider: AdProvider;

  /**
   * Yalnızca platform=web + Google AdSense anlamlı.
   * all = mobil+masaüstü; aksi halde ilgili yüzeyde göster.
   */
  @Column({ type: 'varchar', length: 16, nullable: true })
  web_surface: WebSurface | null;

  @Column({ type: 'varchar', length: 64 })
  placement: string;

  @Column({ type: 'varchar', length: 32, default: 'banner' })
  format: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 16, default: 'contextual' })
  consent_mode: AdConsentMode;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'int', default: 0 })
  priority: number;

  @Column({ type: 'timestamptz', nullable: true })
  starts_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  ends_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  creator: User | null;

  @AfterLoad()
  normalizePayload(): void {
    if (this.payload == null) this.payload = {};
  }
}
