-- Sabah hatırlatması saati isteğe bağlı: NULL = sistem varsayılanı (07:00)
ALTER TABLE exam_duty_preferences
  ALTER COLUMN pref_exam_day_morning_time DROP DEFAULT;
ALTER TABLE exam_duty_preferences
  ALTER COLUMN pref_exam_day_morning_time DROP NOT NULL;
