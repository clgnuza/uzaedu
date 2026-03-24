import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BilsemOutcomeSet } from './bilsem-outcome-set.entity';

@Entity('bilsem_outcome_item')
export class BilsemOutcomeItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'bilsem_outcome_set_id', type: 'uuid' })
  bilsemOutcomeSetId: string;

  @ManyToOne(() => BilsemOutcomeSet, (set) => set.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bilsem_outcome_set_id' })
  bilsemOutcomeSet: BilsemOutcomeSet;

  @Column({ name: 'week_order', type: 'int', nullable: true })
  weekOrder: number | null;

  @Column({ type: 'text', nullable: true })
  unite: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  code: string | null;

  @Column({ type: 'text' })
  description: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ type: 'varchar', length: 32, nullable: true })
  ay: string | null;

  @Column({ name: 'ders_saati', type: 'int', nullable: true, default: 2 })
  dersSaati: number | null;

  @Column({ type: 'text', nullable: true })
  konu: string | null;

  @Column({ name: 'surec_bilesenleri', type: 'text', nullable: true })
  surecBilesenleri: string | null;

  @Column({ name: 'olcme_degerlendirme', type: 'text', nullable: true })
  olcmeDegerlendirme: string | null;

  @Column({ name: 'sosyal_duygusal', type: 'text', nullable: true })
  sosyalDuygusal: string | null;

  @Column({ type: 'text', nullable: true })
  degerler: string | null;

  @Column({ type: 'text', nullable: true })
  okuryazarlik: string | null;

  @Column({ name: 'belirli_gun_hafta', type: 'text', nullable: true })
  belirliGunHafta: string | null;

  @Column({ name: 'programlar_arasi', type: 'text', nullable: true })
  programlarArasi: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
