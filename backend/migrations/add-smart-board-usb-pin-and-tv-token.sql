-- Öğretmen USB tahta PIN + sınıf TV oturum belirteci
-- psql: \i backend/migrations/add-smart-board-usb-pin-and-tv-token.sql

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS smart_board_usb_pin_hash VARCHAR(255) NULL;

COMMENT ON COLUMN users.smart_board_usb_pin_hash IS 'Sınıf tahtası USB kilit açma PIN''i (bcrypt); okul yöneticisi atanır.';

CREATE TABLE IF NOT EXISTS tv_classroom_usb_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash VARCHAR(64) NOT NULL,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES smart_board_devices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tv_classroom_usb_tokens_hash ON tv_classroom_usb_tokens (token_hash);
CREATE INDEX IF NOT EXISTS idx_tv_classroom_usb_tokens_expires ON tv_classroom_usb_tokens (expires_at);
