ALTER TABLE bilsem_outcome_set ADD COLUMN IF NOT EXISTS subject_code VARCHAR(64) NULL;
ALTER TABLE bilsem_outcome_set ADD COLUMN IF NOT EXISTS subject_label VARCHAR(256) NULL;
CREATE INDEX IF NOT EXISTS idx_bilsem_outcome_set_subject ON bilsem_outcome_set (subject_code);
