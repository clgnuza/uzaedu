-- Öğretmen / okul yöneticisi: nöbet günü gelen kutusu hatırlatması (TSİ saati)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS duty_reminder_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS duty_reminder_time_tr varchar(5) NOT NULL DEFAULT '07:00';

COMMENT ON COLUMN users.duty_reminder_enabled IS 'Bugün yayınlanmış nöbeti varsa gelen kutusu hatırlatması açık mı (TSİ).';
COMMENT ON COLUMN users.duty_reminder_time_tr IS 'Europe/Istanbul HH:mm (örn. 07:00).';
