import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('dt_acceptance_commission_members')
export class DtAcceptanceCommissionMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'commission_id', type: 'uuid' })
  commissionId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  title: string | null;

  @Column({ name: 'duty_label', type: 'varchar', length: 128, nullable: true })
  dutyLabel: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
