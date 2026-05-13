ALTER TABLE yolluk_calculation
  ADD COLUMN IF NOT EXISTS archived_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_yolluk_calc_school_archived_created
  ON yolluk_calculation (school_id, archived_at, created_at DESC);
