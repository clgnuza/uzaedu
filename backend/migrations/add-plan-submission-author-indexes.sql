-- listMine / status count sorguları (author_user_id)
CREATE INDEX IF NOT EXISTS idx_bps_author_updated_at ON bilsem_plan_submission (author_user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_bps_author_status ON bilsem_plan_submission (author_user_id, status);

CREATE INDEX IF NOT EXISTS idx_yps_author_updated_at ON yillik_plan_submission (author_user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_yps_author_status ON yillik_plan_submission (author_user_id, status);
