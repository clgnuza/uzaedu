-- Add session_type to sorumluluk_sessions (yazili / uygulama / mixed)
ALTER TABLE sorumluluk_sessions
  ADD COLUMN IF NOT EXISTS session_type VARCHAR(20) NOT NULL DEFAULT 'yazili';
