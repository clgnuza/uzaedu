-- Haber görseli için image_url kolonu
-- Çalıştırma: Get-Content backend/migrations/add-content-items-image-url.sql | docker exec -i ogretmenpro-db psql -U postgres -d ogretmenpro

ALTER TABLE content_items ADD COLUMN IF NOT EXISTS image_url VARCHAR(1024);
