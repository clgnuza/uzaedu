-- Nöbet slot saatleri (giriş/çıkış) + okul varsayılan nöbet saatleri
-- Çalıştırma: psql -U postgres -d ogretmenpro -f migrations/add-duty-slot-times-and-school-duty-hours.sql

-- duty_slot: nöbet giriş/çıkış saatleri (HH:mm formatı)
ALTER TABLE duty_slot
  ADD COLUMN IF NOT EXISTS slot_start_time VARCHAR(5),
  ADD COLUMN IF NOT EXISTS slot_end_time VARCHAR(5);

COMMENT ON COLUMN duty_slot.slot_start_time IS 'Nöbet başlangıç saati (HH:mm). MEB: ilk ders -30 dk.';
COMMENT ON COLUMN duty_slot.slot_end_time IS 'Nöbet bitiş saati (HH:mm). MEB: son ders +30 dk.';

-- schools: okul bazlı varsayılan nöbet saatleri (boşsa slot değerleri kullanılır)
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS duty_start_time VARCHAR(5),
  ADD COLUMN IF NOT EXISTS duty_end_time VARCHAR(5);

COMMENT ON COLUMN schools.duty_start_time IS 'Varsayılan nöbet başlangıç saati (HH:mm). Örn: 08:00';
COMMENT ON COLUMN schools.duty_end_time IS 'Varsayılan nöbet bitiş saati (HH:mm). Örn: 15:30';
