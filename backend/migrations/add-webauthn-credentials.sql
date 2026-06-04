-- Parmak izi / yüz (WebAuthn passkey) kimlik bilgileri
-- Get-Content backend/migrations/add-webauthn-credentials.sql | docker exec -i ogretmenpro-db psql -U postgres -d ogretmenpro

CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id text NOT NULL UNIQUE,
  public_key bytea NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  device_type varchar(32),
  backed_up boolean DEFAULT false,
  transports jsonb,
  name varchar(120),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_user_id ON webauthn_credentials(user_id);
