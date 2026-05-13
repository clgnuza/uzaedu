-- Doğrudan Temin: ödeme kayıtları (teklif opsiyonel ilişki)
CREATE TABLE IF NOT EXISTS dt_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL,
  dt_file_id UUID NOT NULL REFERENCES dt_files(id) ON DELETE CASCADE,
  quote_id UUID NULL REFERENCES dt_quotes(id) ON DELETE SET NULL,
  amount NUMERIC(14,6) NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT NULL,
  reference_no VARCHAR(64) NULL,
  created_by_user_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_dt_payments_school_file ON dt_payments(school_id, dt_file_id);
