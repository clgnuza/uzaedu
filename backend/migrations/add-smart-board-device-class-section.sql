-- Akıllı Tahta cihaz sınıf eşlemesi – Ders programından otomatik slot almak için
-- Çalıştırma: Get-Content backend/migrations/add-smart-board-device-class-section.sql | docker exec -i ogretmenpro-db psql -U postgres -d ogretmenpro

ALTER TABLE smart_board_devices
  ADD COLUMN IF NOT EXISTS class_section VARCHAR(32);

COMMENT ON COLUMN smart_board_devices.class_section IS 'Sınıf (örn. 9-A). Ders programından otomatik slot almak için kullanılır.';
