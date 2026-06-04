import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('webauthn_credentials')
export class WebauthnCredential {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'text', unique: true })
  credential_id: string;

  @Column({ type: 'bytea' })
  public_key: Buffer;

  @Column({ type: 'bigint', default: 0 })
  counter: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  device_type: string | null;

  @Column({ type: 'boolean', nullable: true })
  backed_up: boolean | null;

  @Column({ type: 'jsonb', nullable: true })
  transports: string[] | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  name: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  last_used_at: Date | null;
}
