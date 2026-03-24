-- Sınav görevi tarih doğrulama durumu (GPT): admin'de "doğrulandı / düzeltildi / inceleme gerekli" gösterimi.
-- Çalıştırma: Get-Content -Encoding UTF8 backend/migrations/add-exam-duty-date-validation-status.sql | docker exec -i ogretmenpro-db env PGCLIENTENCODING=UTF8 psql -U postgres -d ogretmenpro

ALTER TABLE exam_duties
  ADD COLUMN IF NOT EXISTS date_validation_status varchar(32) NULL,
  ADD COLUMN IF NOT EXISTS date_validation_issues text NULL;

COMMENT ON COLUMN exam_duties.date_validation_status IS 'validated | corrected | needs_review; null = doğrulama yapılmadı';
COMMENT ON COLUMN exam_duties.date_validation_issues IS 'GPT doğrulama uyarıları (Türkçe)';
