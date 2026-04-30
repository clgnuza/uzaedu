-- MEB için tek ortak Word şablonunu geri oluşturur.
-- subject_code NULL olan aktif/merge yillik_plan kaydı yoksa ekler.

UPDATE document_templates
SET
  subject_code = NULL,
  subject_label = 'MEB yıllık plan (ortak şablon)',
  curriculum_model = NULL,
  section = NULL,
  school_type = NULL,
  file_url = 'local:ornek-yillik-plan-modern.docx',
  file_url_local = 'local:ornek-yillik-plan-modern.docx',
  file_format = 'docx',
  requires_merge = TRUE,
  is_active = TRUE,
  form_schema = '[
    {"key":"ogretim_yili","label":"Öğretim Yılı","type":"text","required":true},
    {"key":"sinif","label":"Sınıf","type":"text","required":true},
    {"key":"okul_adi","label":"Çalıştığınız Okulun Tam Adı","type":"text","required":true},
    {"key":"mudur_adi","label":"Müdür Adı","type":"text","required":true},
    {"key":"onay_tarihi","label":"Onay Tarihi","type":"text","required":true},
    {"key":"zumre_ogretmenleri","label":"Zümre Öğretmenleri (virgülle ayırın)","type":"textarea","required":false}
  ]'::jsonb,
  sort_order = 10,
  updated_at = NOW()
WHERE id = (
  SELECT id
  FROM document_templates
  WHERE type = 'yillik_plan'
    AND curriculum_model IS NULL
    AND (subject_code IS NULL OR subject_code = '' OR subject_code = 'cografya')
  ORDER BY created_at ASC
  LIMIT 1
);

INSERT INTO document_templates (
  id,
  type,
  sub_type,
  school_type,
  grade,
  section,
  subject_code,
  subject_label,
  curriculum_model,
  academic_year,
  version,
  file_url,
  file_url_local,
  file_format,
  is_active,
  requires_merge,
  form_schema,
  sort_order
)
SELECT
  gen_random_uuid(),
  'yillik_plan',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  'MEB yıllık plan (ortak şablon)',
  NULL,
  NULL,
  '1',
  'local:ornek-yillik-plan-modern.docx',
  'local:ornek-yillik-plan-modern.docx',
  'docx',
  TRUE,
  TRUE,
  '[
    {"key":"ogretim_yili","label":"Öğretim Yılı","type":"text","required":true},
    {"key":"sinif","label":"Sınıf","type":"text","required":true},
    {"key":"okul_adi","label":"Çalıştığınız Okulun Tam Adı","type":"text","required":true},
    {"key":"mudur_adi","label":"Müdür Adı","type":"text","required":true},
    {"key":"onay_tarihi","label":"Onay Tarihi","type":"text","required":true},
    {"key":"zumre_ogretmenleri","label":"Zümre Öğretmenleri (virgülle ayırın)","type":"textarea","required":false}
  ]'::jsonb,
  10
WHERE NOT EXISTS (
  SELECT 1
  FROM document_templates
  WHERE type = 'yillik_plan'
    AND curriculum_model IS NULL
    AND subject_code IS NULL
);
