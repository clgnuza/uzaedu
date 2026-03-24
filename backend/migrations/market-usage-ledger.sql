-- Jeton/ek ders modül tüketim günlüğü (aylık / yıllık özet için)
CREATE TABLE IF NOT EXISTS market_usage_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_id UUID NULL REFERENCES schools(id) ON DELETE SET NULL,
  debit_target VARCHAR(16) NOT NULL,
  module_key VARCHAR(32) NOT NULL,
  jeton_debit NUMERIC(14, 6) NOT NULL DEFAULT 0,
  ekders_debit NUMERIC(14, 6) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_market_usage_ledger_user_created ON market_usage_ledger (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_usage_ledger_school_created ON market_usage_ledger (school_id, created_at DESC) WHERE school_id IS NOT NULL;

COMMENT ON TABLE market_usage_ledger IS 'Market modül kullanımında jeton/ek ders düşümleri; aylık ve yıllık raporlama.';
