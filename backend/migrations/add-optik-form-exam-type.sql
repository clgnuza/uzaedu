-- Form şablonlarına sınav türü ve sınıf/ders alanları
ALTER TABLE optik_form_templates
  ADD COLUMN IF NOT EXISTS exam_type VARCHAR(32) DEFAULT 'genel',
  ADD COLUMN IF NOT EXISTS grade_level VARCHAR(16),
  ADD COLUMN IF NOT EXISTS subject_hint VARCHAR(64);

COMMENT ON COLUMN optik_form_templates.exam_type IS 'yazili, deneme, quiz, karma, genel';
COMMENT ON COLUMN optik_form_templates.grade_level IS '1-12, LGS, YKS vb.';
COMMENT ON COLUMN optik_form_templates.subject_hint IS 'Matematik, Türkçe vb.';
