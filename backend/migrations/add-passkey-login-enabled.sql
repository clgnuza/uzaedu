-- Biyometrik giriş tercihi (profil ayarı)
-- Get-Content backend/migrations/add-passkey-login-enabled.sql | docker exec -i ogretmenpro-db psql -U postgres -d ogretmenpro

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS passkey_login_enabled boolean NOT NULL DEFAULT true;
