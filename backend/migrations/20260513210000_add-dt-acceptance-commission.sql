-- Migration: add-dt-acceptance-commission

CREATE TABLE dt_acceptance_commission (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  dt_file_id UUID NOT NULL REFERENCES dt_files(id) ON DELETE CASCADE,
  chairman_user_id UUID,
  created_by_user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(dt_file_id)
);

CREATE TABLE dt_acceptance_commission_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id UUID NOT NULL REFERENCES dt_acceptance_commission(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title VARCHAR(128),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(commission_id, user_id)
);

CREATE INDEX idx_dt_commission_school ON dt_acceptance_commission(school_id);
CREATE INDEX idx_dt_commission_file ON dt_acceptance_commission(dt_file_id);
CREATE INDEX idx_dt_commission_members ON dt_acceptance_commission_members(commission_id);
