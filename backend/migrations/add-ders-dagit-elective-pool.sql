-- Faz 37 — Seçmeli havuz

CREATE TABLE IF NOT EXISTS ders_dagit_elective_pool (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES ders_dagit_studio(id) ON DELETE CASCADE,
  name VARCHAR(128) NOT NULL,
  base_section VARCHAR(64) NOT NULL,
  member_sections JSONB NOT NULL DEFAULT '[]',
  subject_names JSONB NOT NULL DEFAULT '[]',
  group_id UUID NULL REFERENCES ders_dagit_group(id) ON DELETE SET NULL,
  weekly_hours_per_track INT NOT NULL DEFAULT 2,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ders_dagit_elective_pool_studio ON ders_dagit_elective_pool(studio_id);
