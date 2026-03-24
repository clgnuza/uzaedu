-- Kullanıcı / okul market bakiyeleri + ledger amount_credited
-- psql -U postgres -d ogretmenpro -f migrations/add-market-balances.sql

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS market_jeton_balance NUMERIC(14,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS market_ekders_balance NUMERIC(14,6) NOT NULL DEFAULT 0;

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS market_jeton_balance NUMERIC(14,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS market_ekders_balance NUMERIC(14,6) NOT NULL DEFAULT 0;

ALTER TABLE market_purchase_ledger
  ADD COLUMN IF NOT EXISTS amount_credited NUMERIC(14,6) NULL,
  ADD COLUMN IF NOT EXISTS credit_target VARCHAR(16) NULL;

COMMENT ON COLUMN users.market_jeton_balance IS 'Bireysel jeton';
COMMENT ON COLUMN users.market_ekders_balance IS 'Bireysel ek ders';
COMMENT ON COLUMN schools.market_jeton_balance IS 'Okul jeton (kurumsal)';
COMMENT ON COLUMN schools.market_ekders_balance IS 'Okul ek ders (kurumsal)';
