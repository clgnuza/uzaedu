-- İşlem günlüğü + IAP doğrulama (market_purchase_ledger)
-- psql -U postgres -d ogretmenpro -f migrations/add-market-purchase-ledger.sql

CREATE TABLE IF NOT EXISTS market_purchase_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  school_id UUID NULL,
  platform VARCHAR(16) NOT NULL,
  product_kind VARCHAR(24) NOT NULL DEFAULT 'unknown',
  currency_kind VARCHAR(16) NOT NULL DEFAULT 'unknown',
  product_id VARCHAR(200) NOT NULL,
  status VARCHAR(24) NOT NULL,
  purchase_token_hash VARCHAR(64) NULL,
  verification_note TEXT NULL,
  provider_detail JSONB NULL,
  credits_applied BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_ledger_user_created ON market_purchase_ledger (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_ledger_token_hash ON market_purchase_ledger (purchase_token_hash);

COMMENT ON TABLE market_purchase_ledger IS 'Google Play / Apple satın alma doğrulama günlüğü';
