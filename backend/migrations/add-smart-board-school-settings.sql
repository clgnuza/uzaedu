-- Akıllı Tahta: Okul bazlı ayarlar (öğretmen kullanımı)
-- Çalıştırma: Get-Content backend/migrations/add-smart-board-school-settings.sql | docker exec -i ogretmenpro-db psql -U postgres -d ogretmenpro

-- Tüm öğretmenlere otomatik yetki (true: yetkili listesine eklemeden bağlanabilir)
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS smart_board_auto_authorize BOOLEAN DEFAULT false;

COMMENT ON COLUMN schools.smart_board_auto_authorize IS 'true ise okuldaki tüm öğretmenler tahtaya bağlanabilir; false ise sadece yetkili listedeki öğretmenler.';

-- Bağlantı süresi (dakika). Heartbeat gelmezse oturum sonlanır. 1-30 arası.
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS smart_board_session_timeout_minutes INT DEFAULT 2;

COMMENT ON COLUMN schools.smart_board_session_timeout_minutes IS 'Öğretmen bağlantısı timeout (dakika). Heartbeat gelmezse oturum sonlanır. 1-30.';
