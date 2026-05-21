-- Ders oturumu: yumuşak devralma, QR'sız yeniden bağlanma, bildirim filtresi
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS smart_board_soft_takeover_seconds INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS smart_board_reconnect_grace_minutes INT NOT NULL DEFAULT 45,
  ADD COLUMN IF NOT EXISTS smart_board_notify_lesson_teachers_only BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN schools.smart_board_soft_takeover_seconds IS '0=anında devral; >0 tahtada geri sayım (sn) sonra önceki oturum kapanır.';
COMMENT ON COLUMN schools.smart_board_reconnect_grace_minutes IS 'Aynı öğretmen+tahta için QR olmadan panelden yeniden bağlanma (dk). 0=kapalı.';
COMMENT ON COLUMN schools.smart_board_notify_lesson_teachers_only IS 'QR bildirimi: yalnız o saatte dersi olan öğretmenlere (program varsa).';

ALTER TABLE smart_board_devices
  ADD COLUMN IF NOT EXISTS pending_takeover_until TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS pending_takeover_user_id UUID NULL,
  ADD COLUMN IF NOT EXISTS pending_takeover_qr_session_id UUID NULL;
