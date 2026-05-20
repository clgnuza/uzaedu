-- Akıllı Tahta TV güvenlik: exchange nonce, güçlü QR, önceki öğretmen ayarı
-- Çalıştırma: Get-Content backend/migrations/add-smart-board-tv-security-202605.sql | docker exec -i ogretmenpro-db psql -U postgres -d ogretmenpro

ALTER TABLE smart_board_qr_sessions
  ADD COLUMN IF NOT EXISTS exchange_nonce VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS exchange_expires_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS exchanged_at TIMESTAMPTZ NULL;

ALTER TABLE smart_board_qr_sessions
  ALTER COLUMN code TYPE VARCHAR(16);

-- Düz metin token artık kullanılmıyor (poll üzerinden sızmayı önlemek için)
UPDATE smart_board_qr_sessions SET issued_usb_token_plain = NULL WHERE issued_usb_token_plain IS NOT NULL;

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS smart_board_release_previous_on_qr BOOLEAN DEFAULT true;

COMMENT ON COLUMN schools.smart_board_release_previous_on_qr IS 'QR onayında aynı tahtadaki önceki öğretmen oturumunu sonlandır (true, varsayılan).';
