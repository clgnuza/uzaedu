-- Öğretmen başına mesaj gönderim tercihleri (imza, wa.me sekme)
CREATE TABLE IF NOT EXISTS messaging_user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  preferences JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, school_id)
);
CREATE INDEX IF NOT EXISTS idx_messaging_user_prefs_school ON messaging_user_preferences(school_id);
