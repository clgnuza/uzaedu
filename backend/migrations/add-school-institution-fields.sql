-- Okul kurumsal bilgileri: MEB okulumuz hakkında sayfasına uyumlu
-- Kurum kodu, kurumsal mail, belgegeçer, adres, Google Maps (devlet okulları için)
-- Çalıştırma: Get-Content backend/migrations/add-school-institution-fields.sql | docker exec -i ogretmenpro-db psql -U postgres -d ogretmenpro

-- MEB kurum kodu (7 hane, devlet okullarında zorunlu)
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS institution_code VARCHAR(16) NULL;

COMMENT ON COLUMN schools.institution_code IS 'MEB kurum kodu. Devlet okulları için zorunludur.';

-- Kurumsal e-posta (örn. info@okuladi.meb.k12.tr)
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS institutional_email VARCHAR(256) NULL;

COMMENT ON COLUMN schools.institutional_email IS 'Kurumsal e-posta adresi. Devlet okulları için meb.k12.tr.';

-- Belgegeçer (Fax)
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS fax VARCHAR(32) NULL;

COMMENT ON COLUMN schools.fax IS 'Belgegeçer (faks) numarası.';

-- Tam adres (mahalle, cadde, no, ilçe/il)
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS address VARCHAR(512) NULL;

COMMENT ON COLUMN schools.address IS 'Okul tam adresi. Örn: Kuruçay Mah. Özgürlük Cad. No:17 Akşehir/KONYA';

-- Google Haritalar linki (yol tarifi veya konum paylaşım linki)
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS map_url VARCHAR(1024) NULL;

COMMENT ON COLUMN schools.map_url IS 'Google Haritalar linki (yol tarifi veya konum paylaşım).';
