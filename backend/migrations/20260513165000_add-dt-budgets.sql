-- Doğrudan Temin (DT): budget accounts + blocks (phase-3)

CREATE TABLE IF NOT EXISTS dt_budget_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  year INT NOT NULL,

  parent_id UUID REFERENCES dt_budget_accounts(id) ON DELETE SET NULL,
  code VARCHAR(64),
  label VARCHAR(255) NOT NULL,

  allocated NUMERIC(14,6) NOT NULL DEFAULT 0,
  blocked NUMERIC(14,6) NOT NULL DEFAULT 0,
  spent NUMERIC(14,6) NOT NULL DEFAULT 0,

  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dt_budget_accounts_school_year ON dt_budget_accounts(school_id, year);
CREATE INDEX IF NOT EXISTS idx_dt_budget_accounts_parent ON dt_budget_accounts(parent_id);

ALTER TABLE dt_files
  ADD COLUMN IF NOT EXISTS budget_account_id UUID REFERENCES dt_budget_accounts(id) ON DELETE SET NULL;

ALTER TABLE dt_files
  ADD COLUMN IF NOT EXISTS approx_total NUMERIC(14,6);

ALTER TABLE dt_files
  ADD COLUMN IF NOT EXISTS decision_total NUMERIC(14,6);

ALTER TABLE dt_files
  ADD COLUMN IF NOT EXISTS payment_total NUMERIC(14,6);

CREATE TABLE IF NOT EXISTS dt_budget_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  dt_file_id UUID NOT NULL REFERENCES dt_files(id) ON DELETE CASCADE,
  budget_account_id UUID NOT NULL REFERENCES dt_budget_accounts(id) ON DELETE RESTRICT,

  amount NUMERIC(14,6) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'blocked', -- blocked|released
  blocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  released_at TIMESTAMP WITH TIME ZONE,

  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dt_budget_blocks_school ON dt_budget_blocks(school_id);
CREATE INDEX IF NOT EXISTS idx_dt_budget_blocks_file ON dt_budget_blocks(dt_file_id);
CREATE INDEX IF NOT EXISTS idx_dt_budget_blocks_account ON dt_budget_blocks(budget_account_id);
CREATE INDEX IF NOT EXISTS idx_dt_budget_blocks_status ON dt_budget_blocks(status);

