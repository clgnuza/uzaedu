-- Öğretmen kişisel ders programları (kendi oluşturduğu programlar)
-- Admin yüklemesi teacher_timetable'da kalır; öğretmen "Programlarım"da hem admin'i hem kendininkini görür
-- Çalıştırma: psql -U postgres -d ogretmenpro -f migrations/add-teacher-personal-program.sql

CREATE TABLE IF NOT EXISTS teacher_personal_program (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(128) NOT NULL,
  academic_year VARCHAR(16) NOT NULL,
  term VARCHAR(32) NOT NULL DEFAULT 'Tüm Yıl',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS teacher_personal_program_entry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES teacher_personal_program(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL,
  lesson_num SMALLINT NOT NULL,
  class_section VARCHAR(32) NOT NULL,
  subject VARCHAR(128) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tpp_school_user ON teacher_personal_program(school_id, user_id);
CREATE INDEX IF NOT EXISTS idx_tppe_program ON teacher_personal_program_entry(program_id);

COMMENT ON TABLE teacher_personal_program IS 'Öğretmenin kendi oluşturduğu ders programları';
COMMENT ON TABLE teacher_personal_program_entry IS 'Kişisel programdaki ders girdileri';
