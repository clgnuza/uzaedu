-- Optik oturum ↔ Kelebek sınav / kazanım planı bağlantıları
ALTER TABLE optik_exam_sessions ADD COLUMN IF NOT EXISTS butterfly_plan_id UUID REFERENCES butterfly_exam_plans(id) ON DELETE SET NULL;
ALTER TABLE optik_exam_sessions ADD COLUMN IF NOT EXISTS outcome_plan_key VARCHAR(256);
ALTER TABLE optik_exam_sessions ADD COLUMN IF NOT EXISTS question_outcomes JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_optik_session_butterfly_plan ON optik_exam_sessions(butterfly_plan_id);
