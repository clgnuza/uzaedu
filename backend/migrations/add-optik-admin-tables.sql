-- Optik modülü: form şablonları, rubrik şablonları, kullanım logu
-- Form şablonları: MEB/LGS/YKS benzeri hazır şablonlar
CREATE TABLE IF NOT EXISTS optik_form_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(128) NOT NULL,
  slug VARCHAR(64) NOT NULL UNIQUE,
  form_type VARCHAR(32) NOT NULL DEFAULT 'multiple_choice',
  question_count INT NOT NULL DEFAULT 20,
  choice_count INT NOT NULL DEFAULT 5,
  page_size VARCHAR(16) DEFAULT 'A4',
  roi_config JSONB,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rubrik şablonları: açık uçlu puanlama için
CREATE TABLE IF NOT EXISTS optik_rubric_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(128) NOT NULL,
  mode VARCHAR(32) NOT NULL,
  subject VARCHAR(64),
  criteria JSONB NOT NULL DEFAULT '[]',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Kullanım logu: OCR ve Grade istekleri
CREATE TABLE IF NOT EXISTS optik_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  usage_type VARCHAR(16) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_optik_usage_user ON optik_usage_log(user_id);
CREATE INDEX IF NOT EXISTS idx_optik_usage_school ON optik_usage_log(school_id);
CREATE INDEX IF NOT EXISTS idx_optik_usage_created ON optik_usage_log(created_at);
