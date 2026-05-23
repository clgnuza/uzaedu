ALTER TABLE ders_dagit_program
  ADD COLUMN IF NOT EXISTS share_settings JSONB NOT NULL DEFAULT '{}';
