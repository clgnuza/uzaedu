-- Ders programı planları: başlangıç/bitiş tarihi, çakışma önleme, yayınlama
-- Çalıştırma: psql -U postgres -d ogretmenpro -f migrations/add-school-timetable-plan.sql

-- Plan tablosu
CREATE TABLE IF NOT EXISTS school_timetable_plan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name VARCHAR(128),
  valid_from DATE NOT NULL,
  valid_until DATE NOT NULL,
  status VARCHAR(32) DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  academic_year VARCHAR(16),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_timetable_plan_school ON school_timetable_plan(school_id);
CREATE INDEX IF NOT EXISTS idx_school_timetable_plan_status ON school_timetable_plan(status);
CREATE INDEX IF NOT EXISTS idx_school_timetable_plan_dates ON school_timetable_plan(valid_from, valid_until);

COMMENT ON TABLE school_timetable_plan IS 'Okul ders programı planı – geçerlilik tarihleri, taslak/yayın';

-- Plan entry tablosu (taslak veriler burada)
CREATE TABLE IF NOT EXISTS school_timetable_plan_entry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES school_timetable_plan(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL,
  lesson_num SMALLINT NOT NULL,
  class_section VARCHAR(32) NOT NULL,
  subject VARCHAR(128) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_school_timetable_plan_entry_plan ON school_timetable_plan_entry(plan_id);

COMMENT ON TABLE school_timetable_plan_entry IS 'Plan ders girdileri – taslak veya yayınlanmış';

-- teacher_timetable'a plan_id ekle (geriye uyumlu)
ALTER TABLE teacher_timetable
  ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES school_timetable_plan(id) ON DELETE CASCADE;

-- Eski unique index kaldırılıp yenisi eklenmeli
DROP INDEX IF EXISTS idx_teacher_timetable_unique;

-- plan_id NULL için: tek set (eski model)
CREATE UNIQUE INDEX IF NOT EXISTS idx_teacher_timetable_unique_legacy
  ON teacher_timetable(school_id, user_id, day_of_week, lesson_num)
  WHERE plan_id IS NULL;

-- plan_id dolu için: plan bazlı
CREATE UNIQUE INDEX IF NOT EXISTS idx_teacher_timetable_unique_plan
  ON teacher_timetable(school_id, plan_id, user_id, day_of_week, lesson_num)
  WHERE plan_id IS NOT NULL;
