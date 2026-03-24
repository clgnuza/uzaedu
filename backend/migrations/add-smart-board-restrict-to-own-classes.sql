-- Akıllı Tahta: Öğretmen sadece dersi olan sınıflara mı bağlansın
-- Çalıştırma: Get-Content backend/migrations/add-smart-board-restrict-to-own-classes.sql | docker exec -i ogretmenpro-db psql -U postgres -d ogretmenpro

-- true: Öğretmen sadece ders verdiği sınıfların tahtalarına bağlanabilir. false: Tüm tahtalara bağlanabilir.
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS smart_board_restrict_to_own_classes BOOLEAN DEFAULT false;

COMMENT ON COLUMN schools.smart_board_restrict_to_own_classes IS 'true: öğretmen sadece ders verdiği sınıfların tahtalarına bağlanır. false: tüm tahtalara bağlanabilir.';
