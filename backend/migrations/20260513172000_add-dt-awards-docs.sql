-- Doğrudan Temin (DT): awards (decision) + generated docs (phase-4)

ALTER TABLE dt_files
  ADD COLUMN IF NOT EXISTS award_mode VARCHAR(32) NOT NULL DEFAULT 'manual';

CREATE TABLE IF NOT EXISTS dt_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  dt_file_id UUID NOT NULL REFERENCES dt_files(id) ON DELETE CASCADE,
  dt_item_id UUID NOT NULL REFERENCES dt_items(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES dt_vendors(id) ON DELETE RESTRICT,

  unit_price NUMERIC(14,6) NOT NULL,
  total NUMERIC(14,6),

  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_dt_awards_file_item ON dt_awards(dt_file_id, dt_item_id);
CREATE INDEX IF NOT EXISTS idx_dt_awards_school ON dt_awards(school_id);
CREATE INDEX IF NOT EXISTS idx_dt_awards_file ON dt_awards(dt_file_id);
CREATE INDEX IF NOT EXISTS idx_dt_awards_vendor ON dt_awards(vendor_id);

CREATE TABLE IF NOT EXISTS dt_generated_docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  dt_file_id UUID REFERENCES dt_files(id) ON DELETE CASCADE,

  doc_type VARCHAR(64) NOT NULL,
  file_format VARCHAR(16) NOT NULL, -- docx|xlsx
  storage_key VARCHAR(512) NOT NULL,
  filename VARCHAR(255) NOT NULL,

  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dt_generated_docs_school ON dt_generated_docs(school_id);
CREATE INDEX IF NOT EXISTS idx_dt_generated_docs_file ON dt_generated_docs(dt_file_id);
CREATE INDEX IF NOT EXISTS idx_dt_generated_docs_type ON dt_generated_docs(doc_type);

