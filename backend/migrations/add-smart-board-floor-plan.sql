-- Akıllı Tahta: Kroki planı üzerinde tahta yerleştirme
-- Çalıştırma: Get-Content backend/migrations/add-smart-board-floor-plan.sql | docker exec -i ogretmenpro-db psql -U postgres -d ogretmenpro

-- Okul kroki plan görseli URL (örn. imgur, cloudinary)
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS smart_board_floor_plan_url VARCHAR(512);

COMMENT ON COLUMN schools.smart_board_floor_plan_url IS 'Akıllı Tahta yerleşim kroki planı görsel URL. Admin tahtaları bu plan üzerinde konumlandırır.';

-- Cihaz konumu: kroki üzerinde yüzde (0-100). plan_position_x, plan_position_y
ALTER TABLE smart_board_devices
  ADD COLUMN IF NOT EXISTS plan_position_x DECIMAL(5,2);

ALTER TABLE smart_board_devices
  ADD COLUMN IF NOT EXISTS plan_position_y DECIMAL(5,2);

COMMENT ON COLUMN smart_board_devices.plan_position_x IS 'Kroki plan üzerinde X konumu (0-100 yüzde).';
COMMENT ON COLUMN smart_board_devices.plan_position_y IS 'Kroki plan üzerinde Y konumu (0-100 yüzde).';
