-- Migration: add-dt-material-library

CREATE TABLE dt_material_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  name VARCHAR(256) NOT NULL,
  parent_id UUID REFERENCES dt_material_categories(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, name, parent_id)
);

CREATE INDEX idx_dt_material_categories_school ON dt_material_categories(school_id);
CREATE INDEX idx_dt_material_categories_parent ON dt_material_categories(parent_id);

CREATE TABLE dt_material_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  category_id UUID REFERENCES dt_material_categories(id),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(512) NOT NULL,
  description TEXT,
  unit VARCHAR(32),
  vat_rate INT DEFAULT 20,
  created_by_user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, code)
);

CREATE INDEX idx_dt_material_library_school ON dt_material_library(school_id);
CREATE INDEX idx_dt_material_library_category ON dt_material_library(category_id);
CREATE INDEX idx_dt_material_library_code ON dt_material_library(code);
