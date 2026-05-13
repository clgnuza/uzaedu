-- Doğrudan Temin (DT): vendors + quotes (phase-2)

CREATE TABLE IF NOT EXISTS dt_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,

  title VARCHAR(255) NOT NULL,
  tax_no VARCHAR(32),
  contact_name VARCHAR(128),
  phone VARCHAR(32),
  email VARCHAR(255),
  address VARCHAR(512),

  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dt_vendors_school ON dt_vendors(school_id);
CREATE INDEX IF NOT EXISTS idx_dt_vendors_title ON dt_vendors(title);
CREATE INDEX IF NOT EXISTS idx_dt_vendors_taxno ON dt_vendors(tax_no);

CREATE TABLE IF NOT EXISTS dt_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  dt_file_id UUID NOT NULL REFERENCES dt_files(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES dt_vendors(id) ON DELETE RESTRICT,

  status VARCHAR(16) NOT NULL DEFAULT 'requested', -- requested|received|rejected|accepted
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  received_at TIMESTAMP WITH TIME ZONE,
  note TEXT,

  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dt_quotes_school ON dt_quotes(school_id);
CREATE INDEX IF NOT EXISTS idx_dt_quotes_file ON dt_quotes(dt_file_id);
CREATE INDEX IF NOT EXISTS idx_dt_quotes_vendor ON dt_quotes(vendor_id);
CREATE INDEX IF NOT EXISTS idx_dt_quotes_status ON dt_quotes(status);

CREATE TABLE IF NOT EXISTS dt_quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  quote_id UUID NOT NULL REFERENCES dt_quotes(id) ON DELETE CASCADE,
  dt_item_id UUID NOT NULL REFERENCES dt_items(id) ON DELETE CASCADE,

  unit_price NUMERIC(14,6) NOT NULL,
  total NUMERIC(14,6),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_dt_quote_items_quote_item ON dt_quote_items(quote_id, dt_item_id);
CREATE INDEX IF NOT EXISTS idx_dt_quote_items_school ON dt_quote_items(school_id);
CREATE INDEX IF NOT EXISTS idx_dt_quote_items_quote ON dt_quote_items(quote_id);
CREATE INDEX IF NOT EXISTS idx_dt_quote_items_item ON dt_quote_items(dt_item_id);

