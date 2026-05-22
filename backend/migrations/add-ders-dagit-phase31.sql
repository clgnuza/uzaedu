-- Faz 31-32: paylaşım, arşiv, iş kuyruğu meta

ALTER TABLE ders_dagit_program
  ADD COLUMN IF NOT EXISTS share_token VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ders_dagit_program_share_token
  ON ders_dagit_program (share_token) WHERE share_token IS NOT NULL;
