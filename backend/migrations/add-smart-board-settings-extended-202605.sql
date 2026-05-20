-- Akıllı tahta: kiosk/kilit varsayılanları, QR devralma bildirimi
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS smart_board_default_kiosk BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS smart_board_default_kilit BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS smart_board_notify_on_qr_takeover BOOLEAN DEFAULT true;

COMMENT ON COLUMN schools.smart_board_default_kiosk IS 'Tahta URL/USB paketinde kiosk=1 varsayılanı.';
COMMENT ON COLUMN schools.smart_board_default_kilit IS 'Tahta URL/USB paketinde kilit=1 (duyuru modu) varsayılanı.';
COMMENT ON COLUMN schools.smart_board_notify_on_qr_takeover IS 'QR ile yeni öğretmen bağlandığında önceki öğretmene Inbox bildirimi.';
