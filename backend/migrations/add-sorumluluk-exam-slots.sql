-- Sorumluluk sınavı: planlama öncesi müsait gün/saat slotları
CREATE TABLE IF NOT EXISTS sorumluluk_exam_slots (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     UUID NOT NULL REFERENCES sorumluluk_groups(id) ON DELETE CASCADE,
  school_id    UUID NOT NULL,
  session_date DATE NOT NULL,
  start_time   TIME NOT NULL,
  end_time     TIME NOT NULL,
  room_name    VARCHAR(100),
  capacity     INTEGER NOT NULL DEFAULT 30,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  label        VARCHAR(120),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sorumluluk_exam_slots_group ON sorumluluk_exam_slots(group_id);
CREATE INDEX IF NOT EXISTS idx_sorumluluk_exam_slots_date ON sorumluluk_exam_slots(session_date);
