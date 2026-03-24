-- Sınav görevi sync iyileştirmeleri: ardışık hata sayacı + duplicate engeli
-- 1) exam_duty_sync_sources: consecutive_error_count (3+ üst üste hata → superadmin bildirimi)
-- 2) exam_duties: (source_key, external_id) unique (NULL hariç) – aynı kaynak+URL tek kayıt

-- consecutive_error_count
ALTER TABLE exam_duty_sync_sources
  ADD COLUMN IF NOT EXISTS consecutive_error_count int NOT NULL DEFAULT 0;

-- Unique index: aynı kaynak + aynı external_id ile birden fazla kayıt engellenir (NULL'lar hariç)
CREATE UNIQUE INDEX IF NOT EXISTS idx_exam_duties_source_external_unique
  ON exam_duties (source_key, external_id)
  WHERE source_key IS NOT NULL AND external_id IS NOT NULL;

COMMENT ON COLUMN exam_duty_sync_sources.consecutive_error_count IS 'Üst üste sync hata sayısı; 3 olunca superadmin bildirimi, sonra sıfırlanır';
