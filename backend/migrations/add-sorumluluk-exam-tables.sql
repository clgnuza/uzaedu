-- Sorumluluk / Beceri Sınavları Modülü tabloları
-- Çalıştırma: psql -d ogretmenpro -f add-sorumluluk-exam-tables.sql

-- 1. Grup (sınav dönemi / plan)
CREATE TABLE IF NOT EXISTS sorumluluk_groups (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title        VARCHAR(255) NOT NULL,
  academic_year VARCHAR(50),
  exam_type    VARCHAR(20) NOT NULL DEFAULT 'sorumluluk', -- sorumluluk | beceri
  status       VARCHAR(20) NOT NULL DEFAULT 'draft',      -- draft | active | completed | archived
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sorumluluk_groups_school ON sorumluluk_groups(school_id);

-- 2. Öğrenciler (bireysel, ders listesiyle)
CREATE TABLE IF NOT EXISTS sorumluluk_students (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id       UUID NOT NULL REFERENCES sorumluluk_groups(id) ON DELETE CASCADE,
  school_id      UUID NOT NULL,
  student_name   VARCHAR(255) NOT NULL,
  student_number VARCHAR(50),
  class_name     VARCHAR(50),
  subjects       JSONB NOT NULL DEFAULT '[]', -- [{subjectName, sessionId?}]
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sorumluluk_students_group ON sorumluluk_students(group_id);
CREATE INDEX IF NOT EXISTS idx_sorumluluk_students_school ON sorumluluk_students(school_id);

-- 3. Sınav oturumları (ders + tarih + saat + salon)
CREATE TABLE IF NOT EXISTS sorumluluk_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     UUID NOT NULL REFERENCES sorumluluk_groups(id) ON DELETE CASCADE,
  school_id    UUID NOT NULL,
  subject_name VARCHAR(255) NOT NULL,
  session_date DATE NOT NULL,
  start_time   TIME NOT NULL,
  end_time     TIME NOT NULL,
  room_name    VARCHAR(100),
  capacity     INTEGER NOT NULL DEFAULT 30,
  status       VARCHAR(20) NOT NULL DEFAULT 'planned', -- planned | active | completed | cancelled
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sorumluluk_sessions_group ON sorumluluk_sessions(group_id);
CREATE INDEX IF NOT EXISTS idx_sorumluluk_sessions_date  ON sorumluluk_sessions(session_date);

-- 4. Öğrenci-oturum atamaları
CREATE TABLE IF NOT EXISTS sorumluluk_session_students (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID NOT NULL REFERENCES sorumluluk_sessions(id) ON DELETE CASCADE,
  student_id        UUID NOT NULL REFERENCES sorumluluk_students(id) ON DELETE CASCADE,
  attendance_status VARCHAR(20), -- present | absent | excused | null
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_sorumluluk_ss_session ON sorumluluk_session_students(session_id);
CREATE INDEX IF NOT EXISTS idx_sorumluluk_ss_student ON sorumluluk_session_students(student_id);

-- 5. Oturum görevlileri (komisyon üyesi / gözcü)
CREATE TABLE IF NOT EXISTS sorumluluk_session_proctors (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sorumluluk_sessions(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       VARCHAR(20) NOT NULL DEFAULT 'gozcu', -- komisyon_uye | gozcu
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, user_id, role)
);
CREATE INDEX IF NOT EXISTS idx_sorumluluk_sp_session ON sorumluluk_session_proctors(session_id);
