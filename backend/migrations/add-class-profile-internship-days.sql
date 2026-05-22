ALTER TABLE ders_dagit_class_profile
  ADD COLUMN IF NOT EXISTS internship_days jsonb NOT NULL DEFAULT '[]'::jsonb;
