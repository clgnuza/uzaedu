-- Öğretmen ders programı – nöbet dağılımı ve günlük tablo için
-- Çalıştırma: psql -U postgres -d ogretmenpro -f migrations/add-teacher-timetable.sql

CREATE TABLE IF NOT EXISTS teacher_timetable (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL,
  lesson_num SMALLINT NOT NULL,
  class_section VARCHAR(32) NOT NULL,
  subject VARCHAR(128) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_teacher_timetable_school ON teacher_timetable(school_id);
CREATE INDEX IF NOT EXISTS idx_teacher_timetable_user ON teacher_timetable(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_teacher_timetable_unique
  ON teacher_timetable(school_id, user_id, day_of_week, lesson_num);

COMMENT ON TABLE teacher_timetable IS 'Öğretmen haftalık ders programı – gün, saat, sınıf, ders';
