-- Akıllı Tahta: Öğretmen deneyimi – şikayetlere yönelik ayarlar
-- Çalıştırma: Get-Content backend/migrations/add-smart-board-teacher-settings.sql | docker exec -i ogretmenpro-db psql -U postgres -d ogretmenpro

-- Bağlantı idare tarafından kesildiğinde öğretmene Inbox bildirimi gönder
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS smart_board_notify_on_disconnect BOOLEAN DEFAULT true;

COMMENT ON COLUMN schools.smart_board_notify_on_disconnect IS 'Admin bağlantıyı sonlandırdığında öğretmene Inbox bildirimi gönderilir.';

-- Ders saati bitince otomatik bağlantı kes (lesson_schedule'a göre)
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS smart_board_auto_disconnect_lesson_end BOOLEAN DEFAULT false;

COMMENT ON COLUMN schools.smart_board_auto_disconnect_lesson_end IS 'Ders saati bittiğinde heartbeat sırasında otomatik bağlantı kesilir. lesson_schedule gerekli.';
