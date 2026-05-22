-- DersDağıt modülü — Program Stüdyosu veri modeli

CREATE TABLE IF NOT EXISTS ders_dagit_studio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year VARCHAR(16) NOT NULL DEFAULT '',
  name VARCHAR(128) NULL,
  workflow_status VARCHAR(32) NOT NULL DEFAULT 'setup',
  settings JSONB NOT NULL DEFAULT '{}',
  health_score INT NOT NULL DEFAULT 0,
  preference_window_open BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, academic_year)
);

CREATE TABLE IF NOT EXISTS ders_dagit_class_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES ders_dagit_studio(id) ON DELETE CASCADE,
  name VARCHAR(128) NOT NULL,
  class_sections JSONB NOT NULL DEFAULT '[]',
  start_time VARCHAR(8) NULL,
  end_time VARCHAR(8) NULL,
  latest_start_time VARCHAR(8) NULL,
  min_lessons_per_day INT NULL,
  max_lessons_per_day INT NOT NULL DEFAULT 8,
  min_weekly_lessons INT NULL,
  max_weekly_lessons INT NULL,
  education_shift VARCHAR(16) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ders_dagit_teacher_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES ders_dagit_studio(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  branch VARCHAR(64) NULL,
  mandatory_weekly_hours INT NULL,
  max_extra_weekly_hours INT NULL,
  max_lessons_per_day INT NULL,
  min_work_days INT NULL,
  max_work_days INT NULL,
  allow_am_pm_gap BOOLEAN NOT NULL DEFAULT true,
  unavailable_periods JSONB NOT NULL DEFAULT '[]',
  constraints JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (studio_id, user_id)
);

CREATE TABLE IF NOT EXISTS ders_dagit_subject (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES ders_dagit_studio(id) ON DELETE CASCADE,
  name VARCHAR(128) NOT NULL,
  short_code VARCHAR(16) NULL,
  color VARCHAR(16) NULL,
  is_practical BOOLEAN NOT NULL DEFAULT false,
  is_elective BOOLEAN NOT NULL DEFAULT false,
  class_hours JSONB NOT NULL DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ders_dagit_group (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES ders_dagit_studio(id) ON DELETE CASCADE,
  name VARCHAR(64) NOT NULL,
  abbreviation VARCHAR(8) NOT NULL,
  color VARCHAR(16) NULL,
  parallel_mode VARCHAR(32) NULL,
  member_sections JSONB NOT NULL DEFAULT '[]',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (studio_id, abbreviation)
);

CREATE TABLE IF NOT EXISTS ders_dagit_building (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name VARCHAR(128) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ders_dagit_room (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  building_id UUID NULL REFERENCES ders_dagit_building(id) ON DELETE SET NULL,
  name VARCHAR(128) NOT NULL,
  capacity INT NULL,
  features JSONB NOT NULL DEFAULT '[]',
  allowed_subjects JSONB NULL,
  allowed_class_sections JSONB NULL,
  allowed_teacher_ids JSONB NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ders_dagit_assignment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES ders_dagit_studio(id) ON DELETE CASCADE,
  subject_id UUID NULL REFERENCES ders_dagit_subject(id) ON DELETE SET NULL,
  subject_name VARCHAR(128) NOT NULL,
  group_id UUID NULL REFERENCES ders_dagit_group(id) ON DELETE SET NULL,
  class_sections JSONB NOT NULL DEFAULT '[]',
  weekly_hours INT NOT NULL DEFAULT 1,
  biweekly BOOLEAN NOT NULL DEFAULT false,
  min_days_per_week INT NULL,
  max_days_per_week INT NULL,
  max_per_day INT NULL,
  priority VARCHAR(16) NOT NULL DEFAULT 'normal',
  place_first BOOLEAN NOT NULL DEFAULT false,
  room_ids JSONB NOT NULL DEFAULT '[]',
  unavailable_periods JSONB NOT NULL DEFAULT '[]',
  fixed_slots JSONB NOT NULL DEFAULT '[]',
  options JSONB NOT NULL DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ders_dagit_assignment_teacher (
  assignment_id UUID NOT NULL REFERENCES ders_dagit_assignment(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (assignment_id, user_id)
);

CREATE TABLE IF NOT EXISTS ders_dagit_rule_set (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES ders_dagit_studio(id) ON DELETE CASCADE UNIQUE,
  rules JSONB NOT NULL DEFAULT '{}',
  building_travel JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ders_dagit_preference (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES ders_dagit_studio(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL,
  lesson_num INT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'unavailable',
  is_hard BOOLEAN NOT NULL DEFAULT true,
  note TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (studio_id, user_id, day_of_week, lesson_num)
);

CREATE TABLE IF NOT EXISTS ders_dagit_request (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES ders_dagit_studio(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(32) NOT NULL DEFAULT 'change',
  body TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  admin_reply TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ders_dagit_program (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES ders_dagit_studio(id) ON DELETE CASCADE,
  name VARCHAR(128) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  version INT NOT NULL DEFAULT 1,
  score INT NULL,
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  valid_from DATE NULL,
  valid_until DATE NULL,
  published_plan_id UUID NULL,
  generation_meta JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ders_dagit_program_entry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES ders_dagit_program(id) ON DELETE CASCADE,
  assignment_id UUID NULL REFERENCES ders_dagit_assignment(id) ON DELETE SET NULL,
  user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  day_of_week INT NOT NULL,
  lesson_num INT NOT NULL,
  class_section VARCHAR(64) NOT NULL,
  subject VARCHAR(128) NOT NULL,
  room_id UUID NULL REFERENCES ders_dagit_room(id) ON DELETE SET NULL,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  group_id UUID NULL REFERENCES ders_dagit_group(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS ders_dagit_generation_job (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES ders_dagit_studio(id) ON DELETE CASCADE,
  status VARCHAR(32) NOT NULL DEFAULT 'queued',
  duration_sec INT NOT NULL DEFAULT 120,
  versions_requested INT NOT NULL DEFAULT 1,
  report JSONB NOT NULL DEFAULT '{}',
  error TEXT NULL,
  started_at TIMESTAMPTZ NULL,
  finished_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ders_dagit_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES ders_dagit_studio(id) ON DELETE CASCADE,
  user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(64) NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ders_dagit_studio_school ON ders_dagit_studio(school_id);
CREATE INDEX IF NOT EXISTS idx_ders_dagit_program_studio ON ders_dagit_program(studio_id);
CREATE INDEX IF NOT EXISTS idx_ders_dagit_entry_program ON ders_dagit_program_entry(program_id);
