-- Sınıf merkezli ders programı (GPT/eokul reconcile çıktısı)
CREATE TABLE IF NOT EXISTS school_class_timetable_entry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES school_timetable_plan(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL,
  lesson_num SMALLINT NOT NULL,
  class_section VARCHAR(32) NOT NULL,
  subject VARCHAR(128) NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  teacher_name VARCHAR(160)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_school_class_timetable_entry_unique
  ON school_class_timetable_entry (plan_id, day_of_week, lesson_num, class_section, subject);

CREATE INDEX IF NOT EXISTS idx_school_class_timetable_entry_school
  ON school_class_timetable_entry (school_id);

COMMENT ON TABLE school_class_timetable_entry IS 'Sınıf merkezli ders programı satırları (plan türevi).';
