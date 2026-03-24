-- Sınav görevi: source_key, external_id (sync kaynağı), deleted_at (soft delete)
-- Duplicate kontrolü ve sync job için.

ALTER TABLE exam_duties
  ADD COLUMN IF NOT EXISTS source_key varchar(64) NULL,
  ADD COLUMN IF NOT EXISTS external_id varchar(256) NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;

COMMENT ON COLUMN exam_duties.source_key IS 'Sync kaynağı anahtarı (örn: exam_duty_meb, exam_duty_osym)';
COMMENT ON COLUMN exam_duties.external_id IS 'Harici sistemdeki ID (WP post_id, RSS guid vb.) - duplicate önleme';
COMMENT ON COLUMN exam_duties.deleted_at IS 'Soft delete zamanı - NULL ise silinmemiş';

CREATE UNIQUE INDEX IF NOT EXISTS idx_exam_duty_source_external
  ON exam_duties(source_key, external_id)
  WHERE source_key IS NOT NULL AND external_id IS NOT NULL AND deleted_at IS NULL;
