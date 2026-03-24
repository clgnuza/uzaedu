-- Form şablonlarına scope (sistem/okul/öğretmen) alanları
ALTER TABLE optik_form_templates
  ADD COLUMN IF NOT EXISTS scope VARCHAR(16) DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Mevcut kayıtlar system scope'unda
UPDATE optik_form_templates SET scope = 'system' WHERE scope IS NULL;

-- Slug UNIQUE kaldırılır (okul/öğretmen aynı slug ile kendi şablonunu ekleyebilir)
ALTER TABLE optik_form_templates DROP CONSTRAINT IF EXISTS optik_form_templates_slug_key;

-- System template'lerde slug unique (school_id NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_optik_form_slug_system
  ON optik_form_templates (slug) WHERE school_id IS NULL AND created_by_user_id IS NULL;

COMMENT ON COLUMN optik_form_templates.scope IS 'system, school, teacher';
COMMENT ON COLUMN optik_form_templates.school_id IS 'Okul bazlı şablon için (scope=school veya teacher)';
COMMENT ON COLUMN optik_form_templates.created_by_user_id IS 'Öğretmen tarafından oluşturulmuş şablon için (scope=teacher)';
