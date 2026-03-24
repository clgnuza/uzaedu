-- Okul görseli (logo/fotoğraf) – Okul Tanıtım, profil vb. için
-- Çalıştırma: Get-Content backend/migrations/add-school-image-url.sql | docker exec -i ogretmenpro-db psql -U postgres -d ogretmenpro

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS school_image_url VARCHAR(512) NULL;

COMMENT ON COLUMN schools.school_image_url IS 'Okul logosu veya tanıtım fotoğrafı URL. Okul Tanıtım, profil vb. sayfalarda kullanılır.';
