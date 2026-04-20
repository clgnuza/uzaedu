-- Akademik takvim haftalarını work_calendar (eğitim öğretim takvimi) ile eşle
-- Çalıştırma: psql -U postgres -d ogretmenpro -f migrations/academic-calendar-use-work-calendar.sql
-- Idempotent: academic_calendar_week yoksa (zaten taşındıysa) atlanır; deploy tekrarında veri silinmez.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'academic_calendar_week'
  ) THEN
    RETURN;
  END IF;

  TRUNCATE academic_calendar_item CASCADE;

  ALTER TABLE academic_calendar_item DROP CONSTRAINT IF EXISTS academic_calendar_item_week_id_fkey;

  ALTER TABLE academic_calendar_item
    ADD CONSTRAINT academic_calendar_item_week_id_fkey
    FOREIGN KEY (week_id) REFERENCES work_calendar(id) ON DELETE CASCADE;

  DROP TABLE IF EXISTS academic_calendar_week CASCADE;
END $$;

COMMENT ON COLUMN academic_calendar_item.week_id IS 'work_calendar.id – hafta yapısı eğitim öğretim takviminden alınır';
