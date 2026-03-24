-- Çalışma takvimine sınav tarihleri (isteğe bağlı) alanı
-- Production'da manuel çalıştırılabilir; local'de TypeORM synchronize otomatik ekler.
ALTER TABLE work_calendar ADD COLUMN IF NOT EXISTS sinav_etiketleri VARCHAR(256) NULL;
