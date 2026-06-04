-- PWA push: sessiz saat, ses/titreşim, kanal kritik bayrağı
-- Get-Content backend/migrations/add-notification-push-settings.sql | docker exec -i ogretmenpro-db psql -U postgres -d ogretmenpro

ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS critical boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS notification_push_settings (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  quiet_hours_enabled boolean NOT NULL DEFAULT false,
  quiet_start_minutes smallint NOT NULL DEFAULT 1320,
  quiet_end_minutes smallint NOT NULL DEFAULT 480,
  timezone varchar(64) NOT NULL DEFAULT 'Europe/Istanbul',
  sound_enabled boolean NOT NULL DEFAULT true,
  vibration_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
