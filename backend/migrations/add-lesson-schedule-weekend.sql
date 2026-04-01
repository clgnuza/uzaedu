-- Hafta sonu ders saatleri (Cmt–Paz). Boş = hafta içi saatleri kullanılır.
-- TypeORM synchronize açıksa bu script gerekmez.

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS lesson_schedule_weekend jsonb NULL,
  ADD COLUMN IF NOT EXISTS lesson_schedule_weekend_pm jsonb NULL;
