CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS yillik_plan_submission (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_id UUID NULL REFERENCES schools(id) ON DELETE SET NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'draft',
  subject_code VARCHAR(64) NOT NULL,
  subject_label VARCHAR(128) NOT NULL,
  grade INT NOT NULL,
  section VARCHAR(16) NULL,
  academic_year VARCHAR(16) NOT NULL,
  tablo_alti_not TEXT NULL,
  items_json TEXT NOT NULL,
  reviewer_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  review_note TEXT NULL,
  submitted_at TIMESTAMPTZ NULL,
  decided_at TIMESTAMPTZ NULL,
  published_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_yillik_plan_submission_status ON yillik_plan_submission(status);
CREATE INDEX IF NOT EXISTS idx_yillik_plan_submission_author ON yillik_plan_submission(author_user_id);
CREATE INDEX IF NOT EXISTS idx_yillik_plan_submission_plan_key ON yillik_plan_submission(subject_code, grade, academic_year, section);

CREATE TABLE IF NOT EXISTS yillik_plan_submission_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES yillik_plan_submission(id) ON DELETE CASCADE,
  from_status VARCHAR(24) NULL,
  to_status VARCHAR(24) NOT NULL,
  actor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_yillik_plan_submission_event_sub ON yillik_plan_submission_event(submission_id);
