-- İkili eğitim (double) + vardiya (shift) desteği
-- Çalıştırma:
-- docker exec -i ogretmenpro-db psql -U postgres -d ogretmenpro < backend/migrations/add-duty-double-education-and-shift.sql

BEGIN;

-- 1) Duty slot shift: morning | afternoon (tekli eğitimde morning kullanılır)
ALTER TABLE duty_slot
  ADD COLUMN IF NOT EXISTS shift VARCHAR(16) NOT NULL DEFAULT 'morning';

COMMENT ON COLUMN duty_slot.shift IS 'Vardiya: morning | afternoon (tekli eğitimde morning)';

-- 2) School duty ayarları
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS duty_education_mode VARCHAR(16) NULL,
  ADD COLUMN IF NOT EXISTS duty_max_lessons INT NULL,
  ADD COLUMN IF NOT EXISTS duty_start_time_pm VARCHAR(5) NULL,
  ADD COLUMN IF NOT EXISTS duty_end_time_pm VARCHAR(5) NULL,
  ADD COLUMN IF NOT EXISTS lesson_schedule_pm JSONB NULL;

COMMENT ON COLUMN schools.duty_education_mode IS 'Nöbet planlama: single | double (ikili eğitim)';
COMMENT ON COLUMN schools.duty_max_lessons IS 'Günlük ders sayısı (6-12). Günlük tablo ve planlama için üst sınır.';
COMMENT ON COLUMN schools.duty_start_time_pm IS 'Öğle vardiyası nöbet başlangıç saati (HH:mm)';
COMMENT ON COLUMN schools.duty_end_time_pm IS 'Öğle vardiyası nöbet bitiş saati (HH:mm)';
COMMENT ON COLUMN schools.lesson_schedule_pm IS 'Öğle vardiyası ders saatleri: [{lesson_num,start_time,end_time}]';

COMMIT;

