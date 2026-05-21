ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS smart_board_notify_on_qr_pending BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN schools.smart_board_notify_on_qr_pending IS 'Tahta QR oluşturulduğunda öğretmene Inbox (aynı tahta için tek okunmamış bildirim güncellenir).';
