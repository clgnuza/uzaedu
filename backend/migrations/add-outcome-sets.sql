-- Kazanım setleri modülü – outcome_set + outcome_item
-- Çalıştırma: psql -U postgres -d ogretmenpro -f migrations/add-outcome-sets.sql

CREATE TABLE IF NOT EXISTS outcome_set (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_code VARCHAR(64) NOT NULL,
  subject_label VARCHAR(128) NOT NULL,
  grade INT NOT NULL,
  section VARCHAR(16),
  academic_year VARCHAR(16),
  source_type VARCHAR(32) DEFAULT 'manual',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outcome_set_subject ON outcome_set(subject_code);
CREATE INDEX IF NOT EXISTS idx_outcome_set_grade ON outcome_set(grade);
CREATE INDEX IF NOT EXISTS idx_outcome_set_year ON outcome_set(academic_year);

CREATE TABLE IF NOT EXISTS outcome_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outcome_set_id UUID NOT NULL REFERENCES outcome_set(id) ON DELETE CASCADE,
  week_order INT,
  unite VARCHAR(256),
  code VARCHAR(64),
  description TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outcome_item_set ON outcome_item(outcome_set_id);
CREATE INDEX IF NOT EXISTS idx_outcome_item_week ON outcome_item(week_order);

COMMENT ON TABLE outcome_set IS 'Branş + sınıf kazanım seti';
COMMENT ON TABLE outcome_item IS 'Tek kazanım – week_order, ünite, kod, metin';
