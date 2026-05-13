-- Doğrudan Temin (DT): dt_files, dt_items (phase-1)

CREATE TABLE IF NOT EXISTS dt_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,

  year INT NOT NULL,
  file_no VARCHAR(32) NOT NULL,
  subject VARCHAR(512) NOT NULL,

  -- 4734/22: 22a..22g
  temin_type VARCHAR(4) NOT NULL,
  -- mal | hizmet | yapim
  scope VARCHAR(16) NOT NULL,
  -- draft | ... (workflow sonradan genişleyecek)
  status VARCHAR(32) NOT NULL DEFAULT 'draft',

  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  archived_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_dt_files_school_year_no ON dt_files(school_id, year, file_no);
CREATE INDEX IF NOT EXISTS idx_dt_files_school ON dt_files(school_id);
CREATE INDEX IF NOT EXISTS idx_dt_files_year ON dt_files(year);
CREATE INDEX IF NOT EXISTS idx_dt_files_status ON dt_files(status);

CREATE TABLE IF NOT EXISTS dt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  dt_file_id UUID NOT NULL REFERENCES dt_files(id) ON DELETE CASCADE,

  name VARCHAR(512) NOT NULL,
  spec TEXT,
  qty NUMERIC(14,6) NOT NULL DEFAULT 1,
  unit VARCHAR(32),
  vat_rate INT NOT NULL DEFAULT 20,

  estimated_unit_price NUMERIC(14,6),
  estimated_total NUMERIC(14,6),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dt_items_school ON dt_items(school_id);
CREATE INDEX IF NOT EXISTS idx_dt_items_file ON dt_items(dt_file_id);
