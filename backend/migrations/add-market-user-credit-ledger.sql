-- Superadmin öğretmen bireysel market yükleme geçmişi (TypeORM synchronize kapalıysa çalıştırın)
CREATE TABLE IF NOT EXISTS market_user_credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  jeton_credit numeric(14, 6) NOT NULL DEFAULT 0,
  ekders_credit numeric(14, 6) NOT NULL DEFAULT 0,
  note text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_market_user_credit_target_created
  ON market_user_credit_ledger (target_user_id, created_at DESC);
