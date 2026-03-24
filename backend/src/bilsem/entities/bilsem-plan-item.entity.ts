import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BilsemGeneratedPlan } from './bilsem-generated-plan.entity';
import { BilsemOutcomeItem } from './bilsem-outcome-item.entity';

@Entity('bilsem_plan_item')
export class BilsemPlanItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'plan_id', type: 'uuid' })
  planId: string;

  @ManyToOne(() => BilsemGeneratedPlan, (plan) => plan.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'plan_id' })
  plan: BilsemGeneratedPlan;

  @Column({ name: 'outcome_item_id', type: 'uuid' })
  outcomeItemId: string;

  @ManyToOne(() => BilsemOutcomeItem, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'outcome_item_id' })
  outcomeItem: BilsemOutcomeItem;

  @Column({ name: 'custom_note', type: 'text', nullable: true })
  customNote: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'assigned_week_order', type: 'int', nullable: true })
  assignedWeekOrder: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
