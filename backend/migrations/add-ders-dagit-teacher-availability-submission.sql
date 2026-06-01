-- Öğretmen müsaitlik tercihi: taslak → gönderildi → onay / ret

CREATE TABLE IF NOT EXISTS ders_dagit_availability_submission (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES ders_dagit_studio(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  periods JSONB NOT NULL DEFAULT '[]',
  teacher_note TEXT NULL,
  admin_reply TEXT NULL,
  submitted_at TIMESTAMPTZ NULL,
  reviewed_at TIMESTAMPTZ NULL,
  reviewed_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dd_avail_sub_studio_status
  ON ders_dagit_availability_submission (studio_id, status, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_dd_avail_sub_user
  ON ders_dagit_availability_submission (studio_id, user_id, updated_at DESC);
