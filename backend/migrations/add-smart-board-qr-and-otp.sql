-- Akıllı Tahta: QR oturumu + öğretmen offline OTP kodları
-- Çalıştırma: psql -U postgres -d ogretmenpro -f migrations/add-smart-board-qr-and-otp.sql

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS smart_board_otp_code_hashes JSONB;

CREATE TABLE IF NOT EXISTS smart_board_qr_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES smart_board_devices(id) ON DELETE CASCADE,
  code VARCHAR(12) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  claimed_at TIMESTAMPTZ NULL,
  claimed_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  issued_usb_token_hash VARCHAR(64) NULL,
  issued_usb_token_plain VARCHAR(255) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE smart_board_qr_sessions
  ADD COLUMN IF NOT EXISTS issued_usb_token_plain VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_smart_board_qr_sessions_school_device
  ON smart_board_qr_sessions(school_id, device_id);
CREATE INDEX IF NOT EXISTS idx_smart_board_qr_sessions_expires
  ON smart_board_qr_sessions(expires_at);
