-- Öğretmen Görev Devri ve Tercihlerim özellikleri – okul admin aç/kapa
-- Çalıştırma: docker exec -i ogretmenpro-db psql -U postgres -d ogretmenpro < backend/migrations/add-duty-teacher-features.sql
-- TypeORM synchronize kullanıyorsanız bu script gerekmez.

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS duty_teacher_swap_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS duty_teacher_preferences_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN schools.duty_teacher_swap_enabled IS 'Nöbet: Öğretmenlere Görev Devri açık mı';
COMMENT ON COLUMN schools.duty_teacher_preferences_enabled IS 'Nöbet: Öğretmenlere Tercihlerim açık mı';
