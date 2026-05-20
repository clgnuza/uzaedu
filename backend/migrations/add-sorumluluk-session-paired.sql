-- Yazılı+Uygulama: ertesi gün uygulama oturumu bağlantısı
ALTER TABLE sorumluluk_sessions
  ADD COLUMN IF NOT EXISTS paired_session_id UUID NULL REFERENCES sorumluluk_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sorumluluk_sessions_paired ON sorumluluk_sessions(paired_session_id);
