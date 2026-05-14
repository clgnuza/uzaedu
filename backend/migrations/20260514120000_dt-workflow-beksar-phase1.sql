-- Doğrudan temin: okul formu (antet/yetkililer), evrak defteri, komisyon türleri, teklif amacı

CREATE TABLE IF NOT EXISTS dt_school_procurement_settings (
  school_id UUID PRIMARY KEY REFERENCES schools(id) ON DELETE CASCADE,
  header_line2 VARCHAR(512),
  header_line3 VARCHAR(512),
  header_line4 VARCHAR(512),
  spending_authority_name VARCHAR(256),
  spending_authority_title VARCHAR(128),
  realization_authority_name VARCHAR(256),
  realization_authority_title VARCHAR(128),
  official_correspondence_code VARCHAR(64),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dt_file_document_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  dt_file_id UUID NOT NULL REFERENCES dt_files(id) ON DELETE CASCADE,
  stage VARCHAR(64) NOT NULL,
  doc_date DATE,
  number_prefix VARCHAR(256),
  number_suffix VARCHAR(128),
  meta JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(dt_file_id, stage)
);
CREATE INDEX IF NOT EXISTS idx_dt_file_doc_reg_file ON dt_file_document_registry(dt_file_id);

ALTER TABLE dt_files ADD COLUMN IF NOT EXISTS procurement_ref VARCHAR(64);

ALTER TABLE dt_quotes ADD COLUMN IF NOT EXISTS purpose VARCHAR(24) NOT NULL DEFAULT 'bid';
CREATE INDEX IF NOT EXISTS idx_dt_quotes_file_purpose ON dt_quotes(dt_file_id, purpose);

ALTER TABLE dt_acceptance_commission_members ADD COLUMN IF NOT EXISTS duty_label VARCHAR(128);

ALTER TABLE dt_acceptance_commission ADD COLUMN IF NOT EXISTS kind VARCHAR(32) NOT NULL DEFAULT 'muayene_kabul';

ALTER TABLE dt_acceptance_commission DROP CONSTRAINT IF EXISTS dt_acceptance_commission_dt_file_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_dt_acceptance_commission_file_kind ON dt_acceptance_commission(dt_file_id, kind);
