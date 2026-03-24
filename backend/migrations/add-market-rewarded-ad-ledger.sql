CREATE TABLE IF NOT EXISTS market_rewarded_ad_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_id varchar(128) NOT NULL UNIQUE,
  jeton_credit numeric(14, 6) NOT NULL,
  ad_unit_key varchar(64) NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_market_rewarded_ad_user_created
  ON market_rewarded_ad_ledger (user_id, created_at DESC);
