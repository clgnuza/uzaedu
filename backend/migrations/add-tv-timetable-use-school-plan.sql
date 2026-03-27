-- Duyuru TV: ders programı kaynağı (okul planı vs manuel)
ALTER TABLE schools ADD COLUMN IF NOT EXISTS tv_timetable_use_school_plan boolean NOT NULL DEFAULT true;
