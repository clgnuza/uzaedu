-- Kelebek sınav: bina, salon, sınav oturumu, koltuk ataması (PostgreSQL)

CREATE TABLE IF NOT EXISTS butterfly_buildings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name VARCHAR(128) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_butterfly_buildings_school ON butterfly_buildings (school_id, sort_order);

CREATE TABLE IF NOT EXISTS butterfly_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  building_id UUID NOT NULL REFERENCES butterfly_buildings(id) ON DELETE CASCADE,
  name VARCHAR(128) NOT NULL,
  capacity INT NOT NULL CHECK (capacity > 0),
  seat_layout VARCHAR(16) NOT NULL DEFAULT 'pair',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_butterfly_rooms_school ON butterfly_rooms (school_id);
CREATE INDEX IF NOT EXISTS idx_butterfly_rooms_building ON butterfly_rooms (building_id, sort_order);

CREATE TABLE IF NOT EXISTS butterfly_exam_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  exam_starts_at TIMESTAMPTZ NOT NULL,
  exam_ends_at TIMESTAMPTZ,
  status VARCHAR(24) NOT NULL DEFAULT 'draft',
  rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_butterfly_exam_plans_school ON butterfly_exam_plans (school_id, exam_starts_at DESC);

CREATE TABLE IF NOT EXISTS butterfly_seat_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES butterfly_exam_plans(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES butterfly_rooms(id) ON DELETE CASCADE,
  seat_index INT NOT NULL CHECK (seat_index >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_butterfly_seat_plan_student UNIQUE (plan_id, student_id),
  CONSTRAINT uq_butterfly_seat_plan_room_seat UNIQUE (plan_id, room_id, seat_index)
);

CREATE INDEX IF NOT EXISTS idx_butterfly_seat_assignments_plan ON butterfly_seat_assignments (plan_id);
CREATE INDEX IF NOT EXISTS idx_butterfly_seat_assignments_student ON butterfly_seat_assignments (student_id);
