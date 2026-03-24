-- Evrak şablonları: R2 yoluna ek olarak yerel fallback (file_url_local)
-- Çalıştırma: psql -U postgres -d ogretmenpro -f migrations/add-file-url-local.sql
ALTER TABLE document_templates
ADD COLUMN IF NOT EXISTS file_url_local VARCHAR(512) NULL;

COMMENT ON COLUMN document_templates.file_url_local IS 'R2 kullanılamazsa yerel fallback; örn. local:ornek-yillik-plan-cografya.xlsx';
