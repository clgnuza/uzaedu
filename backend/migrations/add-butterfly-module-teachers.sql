CREATE TABLE IF NOT EXISTS butterfly_module_teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_butterfly_module_teachers_school ON butterfly_module_teachers(school_id);
