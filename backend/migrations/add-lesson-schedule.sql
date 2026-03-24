-- Okul ders saatleri: 1.-10. ders giriş/çıkış (HH:mm)
-- JSON: [{lesson_num:1, start_time:"08:30", end_time:"09:10"}, ...]

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS lesson_schedule JSONB;

COMMENT ON COLUMN schools.lesson_schedule IS 'Ders saatleri: [{lesson_num, start_time, end_time}, ...]. 1.-10. ders için giriş/çıkış.';
