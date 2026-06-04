-- WebAuthn challenge (cok sunuculu / restart-safe)
-- Get-Content backend/migrations/add-webauthn-challenges.sql | docker exec -i ogretmenpro-db psql -U postgres -d ogretmenpro

CREATE TABLE IF NOT EXISTS webauthn_challenges (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  challenge text NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_expires ON webauthn_challenges(expires_at);
