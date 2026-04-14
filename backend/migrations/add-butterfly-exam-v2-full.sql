-- Kelebek sınav v2: kilitli koltuk, gözetmen (PostgreSQL)

ALTER TABLE butterfly_seat_assignments
  ADD COLUMN IF NOT EXISTS locked BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE butterfly_seat_assignments
  ADD COLUMN IF NOT EXISTS is_manual BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS butterfly_exam_proctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES butterfly_exam_plans(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES butterfly_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label VARCHAR(128),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_butterfly_proctor_plan_room_user UNIQUE (plan_id, room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_butterfly_proctors_plan ON butterfly_exam_proctors (plan_id);
CREATE INDEX IF NOT EXISTS idx_butterfly_proctors_room ON butterfly_exam_proctors (room_id);
