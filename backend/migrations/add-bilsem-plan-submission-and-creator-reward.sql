-- Bilsem: topluluk plan gönderimi, onay kuyruğu, yıllık plan satırı köprüsü, üretim başına jeton ödülü ledger

CREATE TABLE IF NOT EXISTS bilsem_plan_submission (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_id UUID NULL REFERENCES schools(id) ON DELETE SET NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'draft',
  subject_code VARCHAR(64) NOT NULL,
  subject_label VARCHAR(128) NOT NULL,
  ana_grup VARCHAR(64) NOT NULL,
  alt_grup VARCHAR(64) NULL,
  academic_year VARCHAR(16) NOT NULL,
  plan_grade INT NOT NULL,
  tablo_alti_not TEXT NULL,
  items_json TEXT NOT NULL,
  reward_jeton_per_generation NUMERIC(14, 6) NOT NULL DEFAULT 0.25,
  reviewer_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  review_note TEXT NULL,
  submitted_at TIMESTAMPTZ NULL,
  decided_at TIMESTAMPTZ NULL,
  published_at TIMESTAMPTZ NULL,
  version INT NOT NULL DEFAULT 1,
  parent_submission_id UUID NULL REFERENCES bilsem_plan_submission(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bilsem_plan_submission_status ON bilsem_plan_submission(status);
CREATE INDEX IF NOT EXISTS idx_bilsem_plan_submission_author ON bilsem_plan_submission(author_user_id);
CREATE INDEX IF NOT EXISTS idx_bilsem_plan_submission_plan_key ON bilsem_plan_submission(subject_code, academic_year, ana_grup, alt_grup);

CREATE TABLE IF NOT EXISTS bilsem_plan_submission_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES bilsem_plan_submission(id) ON DELETE CASCADE,
  from_status VARCHAR(24) NULL,
  to_status VARCHAR(24) NOT NULL,
  actor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bilsem_plan_submission_event_sub ON bilsem_plan_submission_event(submission_id);

CREATE TABLE IF NOT EXISTS market_plan_creator_reward_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key VARCHAR(128) NOT NULL UNIQUE,
  creator_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  consumer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  submission_id UUID NOT NULL REFERENCES bilsem_plan_submission(id) ON DELETE CASCADE,
  document_generation_id UUID NULL REFERENCES document_generations(id) ON DELETE SET NULL,
  jeton_credit NUMERIC(14, 6) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_market_plan_creator_reward_creator ON market_plan_creator_reward_ledger(creator_user_id);
CREATE INDEX IF NOT EXISTS idx_market_plan_creator_reward_sub ON market_plan_creator_reward_ledger(submission_id);

ALTER TABLE yillik_plan_icerik
  ADD COLUMN IF NOT EXISTS submission_id UUID NULL REFERENCES bilsem_plan_submission(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_yillik_plan_icerik_submission ON yillik_plan_icerik(submission_id);
