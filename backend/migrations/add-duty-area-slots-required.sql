-- Nöbet yerine günlük nöbetçi sayısı – otomatik planlamada kullanılır
-- Çalıştırma: psql -U postgres -d ogretmenpro -f migrations/add-duty-area-slots-required.sql

ALTER TABLE duty_area ADD COLUMN IF NOT EXISTS slots_required INT DEFAULT 1;
COMMENT ON COLUMN duty_area.slots_required IS 'Bu nöbet yerine günlük kaç nöbetçi atanacak (otomatik planlama)';
