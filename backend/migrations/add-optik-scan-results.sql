-- Optik okuma sonuçları (sınıf / ders / şablon raporları)
CREATE TABLE IF NOT EXISTS optik_scan_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  template_id UUID NOT NULL,
  template_name VARCHAR(128) NOT NULL,
  exam_type VARCHAR(32),
  kind VARCHAR(16) NOT NULL DEFAULT 'mc',
  class_id UUID,
  class_name VARCHAR(128),
  subject_id UUID,
  subject_name VARCHAR(128),
  student_label VARCHAR(64),
  answers JSONB NOT NULL DEFAULT '[]',
  answer_count INT NOT NULL DEFAULT 0,
  ambiguous_count INT NOT NULL DEFAULT 0,
  confidence REAL,
  anchor_score REAL,
  grade_score REAL,
  grade_max_score REAL,
  grade_mode VARCHAR(32),
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_optik_scan_user ON optik_scan_results(user_id);
CREATE INDEX IF NOT EXISTS idx_optik_scan_school ON optik_scan_results(school_id);
CREATE INDEX IF NOT EXISTS idx_optik_scan_class ON optik_scan_results(class_id);
CREATE INDEX IF NOT EXISTS idx_optik_scan_subject ON optik_scan_results(subject_id);
CREATE INDEX IF NOT EXISTS idx_optik_scan_template ON optik_scan_results(template_id);
CREATE INDEX IF NOT EXISTS idx_optik_scan_at ON optik_scan_results(scanned_at);
CREATE INDEX IF NOT EXISTS idx_optik_scan_kind ON optik_scan_results(kind);
