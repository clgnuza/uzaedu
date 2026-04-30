-- Öğretmen profilinde görevlendirme ile çalışılan okul alanları
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS teacher_assignment_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS teacher_assignment_school_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_users_teacher_assignment_school_id'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT fk_users_teacher_assignment_school_id
      FOREIGN KEY (teacher_assignment_school_id) REFERENCES schools(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_teacher_assignment_school_id
  ON users(teacher_assignment_school_id);

COMMENT ON COLUMN users.teacher_assignment_active IS 'Öğretmen kendi okulu dışında görevlendirme ile çalışıyor mu.';
COMMENT ON COLUMN users.teacher_assignment_school_id IS 'Öğretmenin görevlendirme ile çalıştığı okul.';
