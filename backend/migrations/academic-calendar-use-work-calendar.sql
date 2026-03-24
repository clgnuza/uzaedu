-- Akademik takvim haftalarını work_calendar (eğitim öğretim takvimi) ile eşle
-- Çalıştırma: psql -U postgres -d ogretmenpro -f migrations/academic-calendar-use-work-calendar.sql

-- 1. Eski verileri temizle (academic_calendar_week id'leri artık geçersiz olacak)
TRUNCATE academic_calendar_item;

-- 2. week_id FK'yı work_calendar'a yönlendir (PostgreSQL varsayılan ad: tablo_sutun_fkey)
ALTER TABLE academic_calendar_item DROP CONSTRAINT IF EXISTS academic_calendar_item_week_id_fkey;

ALTER TABLE academic_calendar_item
  ADD CONSTRAINT academic_calendar_item_week_id_fkey
  FOREIGN KEY (week_id) REFERENCES work_calendar(id) ON DELETE CASCADE;

-- 3. academic_calendar_week tablosunu kaldır
DROP TABLE IF EXISTS academic_calendar_week CASCADE;

COMMENT ON COLUMN academic_calendar_item.week_id IS 'work_calendar.id – hafta yapısı eğitim öğretim takviminden alınır';
