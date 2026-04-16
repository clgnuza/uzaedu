-- TV sınıf ekranı: telefon sunum kumandası (oturum + komut kuyruğu)
-- psql -f migrations/add-tv-remote-session.sql

CREATE TABLE IF NOT EXISTS tv_remote_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES smart_board_devices(id) ON DELETE CASCADE,
  secret_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tv_remote_sessions_device ON tv_remote_sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_tv_remote_sessions_expires ON tv_remote_sessions(expires_at);

CREATE TABLE IF NOT EXISTS tv_remote_commands (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES tv_remote_sessions(id) ON DELETE CASCADE,
  action VARCHAR(16) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tv_remote_commands_session_id_id ON tv_remote_commands(session_id, id);

COMMENT ON TABLE tv_remote_sessions IS 'USB TV oturumu ile eşlenen telefon kumandası; secret tek sefer gösterilir';
COMMENT ON TABLE tv_remote_commands IS 'Kumandadan gelen slayt komutları (TV poll ile tüketir)';
