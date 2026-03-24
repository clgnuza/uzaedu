-- Sınav günü sabah hatırlatması saat tercihi (HH:mm, Turkey). Varsayılan 08:00.
ALTER TABLE exam_duty_preferences ADD COLUMN IF NOT EXISTS pref_exam_day_morning_time VARCHAR(5) DEFAULT '08:00';
