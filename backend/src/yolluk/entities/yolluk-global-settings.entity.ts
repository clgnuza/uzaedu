import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/** Mali yıl bazlı yurt içi yolluk parametreleri (H cetveli gündeliği superadmin girer). */
@Entity('yolluk_global_settings')
@Index(['fiscal_year'], { unique: true })
export class YollukGlobalSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Örn. 2026 */
  @Column({ type: 'int' })
  fiscal_year: number;

  @Column({ name: 'default_daily_tl', type: 'decimal', precision: 12, scale: 2 })
  default_daily_tl: string;

  @Column({ name: 'km_daily_fraction', type: 'decimal', precision: 8, scale: 5, default: '0.05000' })
  km_daily_fraction: string;

  @Column({ type: 'int', default: 20 })
  memur_fixed_multiplier: number;

  @Column({ type: 'int', default: 10 })
  aile_per_multiplier: number;

  @Column({ type: 'int', default: 40 })
  aile_fixed_cap_multiplier: number;

  @Column({ name: 'rules_version', type: 'varchar', length: 64, default: '6245-summary-1' })
  rules_version: string;

  /** Kadro derecesi 1–15 → iç yevmiye (TL); null ise kod varsayılanı + default_daily_tl */
  @Column({ name: 'derece_rates_json', type: 'jsonb', nullable: true })
  derece_rates_json: Record<string, number> | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
