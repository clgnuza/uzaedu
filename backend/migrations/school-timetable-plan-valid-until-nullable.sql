-- valid_until opsiyonel: NULL = açık uçlu, yeni program yayınlanana kadar geçerli
-- Çalıştırma: psql -U postgres -d ogretmenpro -f migrations/school-timetable-plan-valid-until-nullable.sql

ALTER TABLE school_timetable_plan
  ALTER COLUMN valid_until DROP NOT NULL;

COMMENT ON COLUMN school_timetable_plan.valid_until IS 'Bitiş tarihi. NULL ise açık uçlu – yeni program yayınlanana kadar geçerli';
