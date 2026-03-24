-- Akıllı Tahta cihaz programı – hangi saatte hangi ders, hangi öğretmen
-- Çalıştırma: psql -U postgres -d ogretmenpro -f migrations/add-smart-board-device-schedule.sql

CREATE TABLE IF NOT EXISTS smart_board_device_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES smart_board_devices(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week >= 1 AND day_of_week <= 7),
  lesson_num SMALLINT NOT NULL CHECK (lesson_num >= 1 AND lesson_num <= 12),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject VARCHAR(128) NOT NULL,
  class_section VARCHAR(32),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(device_id, day_of_week, lesson_num)
);
CREATE INDEX IF NOT EXISTS idx_smart_board_device_schedule_device ON smart_board_device_schedule(device_id);
CREATE INDEX IF NOT EXISTS idx_smart_board_device_schedule_user ON smart_board_device_schedule(user_id);

COMMENT ON TABLE smart_board_device_schedule IS 'Tahta haftalık programı: gün (1=Pzt..7=Paz), ders saati, öğretmen, ders, sınıf';
