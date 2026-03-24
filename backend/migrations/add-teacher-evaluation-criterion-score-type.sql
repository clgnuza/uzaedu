-- Kriter başına değerlendirme türü: numeric (puan) veya sign (+/-)
-- Çalıştırma: Get-Content backend/migrations/add-teacher-evaluation-criterion-score-type.sql | docker exec -i ogretmenpro-db psql -U postgres -d ogretmenpro

ALTER TABLE teacher_evaluation_criteria ADD COLUMN IF NOT EXISTS score_type VARCHAR(16) DEFAULT 'numeric';
