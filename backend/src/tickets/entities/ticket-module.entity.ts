import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('ticket_modules')
export class TicketModule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 64 })
  name: string;

  @Column({ name: 'icon_key', length: 32, default: 'help-circle' })
  icon_key: string;

  @Column({
    name: 'target_availability',
    length: 24,
  })
  target_availability: 'SCHOOL_ONLY' | 'PLATFORM_ONLY' | 'BOTH';

  @Column({ name: 'is_active', default: true })
  is_active: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sort_order: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
