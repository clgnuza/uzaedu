-- Modül etkinleştirme: idempotent istemci anahtarı + düşüm özeti
ALTER TABLE module_period_activation ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(64) NULL;
ALTER TABLE module_period_activation ADD COLUMN IF NOT EXISTS debit_jeton NUMERIC(14, 6) NULL;
ALTER TABLE module_period_activation ADD COLUMN IF NOT EXISTS debit_ekders NUMERIC(14, 6) NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_module_period_activation_user_idempotency
  ON module_period_activation (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
