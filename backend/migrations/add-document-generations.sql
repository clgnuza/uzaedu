-- Evrak üretim arşivi – kullanıcı bazlı, tekrar indirme
CREATE TABLE IF NOT EXISTS document_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id UUID REFERENCES document_templates(id) ON DELETE SET NULL,
  form_data JSONB NOT NULL DEFAULT '{}',
  display_label VARCHAR(256) NOT NULL,
  grade VARCHAR(8),
  section VARCHAR(32),
  subject_code VARCHAR(64),
  subject_label VARCHAR(128),
  academic_year VARCHAR(16),
  file_format VARCHAR(16) DEFAULT 'docx',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_generations_user_id ON document_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_document_generations_created_at ON document_generations(created_at DESC);
