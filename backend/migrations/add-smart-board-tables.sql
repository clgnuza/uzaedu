-- Akıllı Tahta modülü MVP – cihazlar, yetkili öğretmenler, bağlantı oturumları
-- Çalıştırma: psql -U postgres -d ogretmenpro -f migrations/add-smart-board-tables.sql

CREATE TABLE IF NOT EXISTS smart_board_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  pairing_code VARCHAR(16) NOT NULL,
  name VARCHAR(128) DEFAULT 'Akıllı Tahta',
  room_or_location VARCHAR(128),
  status VARCHAR(16) DEFAULT 'offline',
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, pairing_code)
);
CREATE INDEX IF NOT EXISTS idx_smart_board_devices_school ON smart_board_devices(school_id);

CREATE TABLE IF NOT EXISTS smart_board_authorized_teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_smart_board_auth_school ON smart_board_authorized_teachers(school_id);
CREATE INDEX IF NOT EXISTS idx_smart_board_auth_user ON smart_board_authorized_teachers(user_id);

CREATE TABLE IF NOT EXISTS smart_board_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES smart_board_devices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  disconnected_at TIMESTAMPTZ,
  last_heartbeat_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_smart_board_sessions_device ON smart_board_sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_smart_board_sessions_user ON smart_board_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_smart_board_sessions_connected ON smart_board_sessions(connected_at) WHERE disconnected_at IS NULL;

COMMENT ON TABLE smart_board_devices IS 'Okul akıllı tahta cihazları – pairing_code ile eşleme';
COMMENT ON TABLE smart_board_authorized_teachers IS 'Tahtaya bağlanma yetkisi verilen öğretmenler';
COMMENT ON TABLE smart_board_sessions IS 'Tahta bağlantı oturumları – tek tahta tek öğretmen';
