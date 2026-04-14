-- Doğrulama kodları tablosu + users.email_verified_at
-- Çalıştırma: Get-Content backend/migrations/add-auth-otp-and-email-verified.sql | docker exec -i ogretmenpro-db psql -U postgres -d ogretmenpro
-- TypeORM synchronize açıksa entity ile oluşur; yine de mevcut kullanıcılar için UPDATE çalıştırın.

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ NULL;
UPDATE users SET email_verified_at = COALESCE(school_join_email_verified_at, created_at, NOW())
  WHERE email_verified_at IS NULL;

CREATE TABLE IF NOT EXISTS auth_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  purpose VARCHAR(32) NOT NULL,
  code_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ NULL,
  attempts INT NOT NULL DEFAULT 0,
  meta JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_auth_verification_codes_email_purpose
  ON auth_verification_codes (email, purpose, consumed_at);
