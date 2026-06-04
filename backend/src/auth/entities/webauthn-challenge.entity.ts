import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('webauthn_challenges')
export class WebauthnChallenge {
  @PrimaryColumn({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'text' })
  challenge: string;

  @Column({ type: 'timestamptz' })
  expires_at: Date;
}
