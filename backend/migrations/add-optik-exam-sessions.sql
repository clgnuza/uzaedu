-- Sınav oturumu + gelişmiş tarama alanları
CREATE TABLE IF NOT EXISTS optik_exam_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  title VARCHAR(256) NOT NULL,
  template_id UUID NOT NULL,
  template_name VARCHAR(128) NOT NULL,
  exam_type VARCHAR(32),
  class_id UUID,
  class_name VARCHAR(128),
  subject_id UUID,
  subject_name VARCHAR(128),
  question_count INT NOT NULL DEFAULT 20,
  choice_count INT NOT NULL DEFAULT 5,
  answer_key JSONB NOT NULL DEFAULT '{}',
  scoring_mode VARCHAR(32) NOT NULL DEFAULT 'standard',
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  open_questions JSONB NOT NULL DEFAULT '[]',
  exam_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_optik_session_user ON optik_exam_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_optik_session_school ON optik_exam_sessions(school_id);
CREATE INDEX IF NOT EXISTS idx_optik_session_class ON optik_exam_sessions(class_id);

ALTER TABLE optik_scan_results ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES optik_exam_sessions(id) ON DELETE SET NULL;
ALTER TABLE optik_scan_results ADD COLUMN IF NOT EXISTS student_id UUID;
ALTER TABLE optik_scan_results ADD COLUMN IF NOT EXISTS correct_count INT;
ALTER TABLE optik_scan_results ADD COLUMN IF NOT EXISTS wrong_count INT;
ALTER TABLE optik_scan_results ADD COLUMN IF NOT EXISTS blank_count INT;
ALTER TABLE optik_scan_results ADD COLUMN IF NOT EXISTS net_score REAL;
ALTER TABLE optik_scan_results ADD COLUMN IF NOT EXISTS open_grades JSONB;

CREATE INDEX IF NOT EXISTS idx_optik_scan_session ON optik_scan_results(session_id);
CREATE INDEX IF NOT EXISTS idx_optik_scan_student ON optik_scan_results(student_id);
