-- Bildirimler tablosuna metadata sütunu (deep link, tarih vb.)
-- Çalıştırma: Get-Content backend/migrations/add-notification-metadata.sql | docker exec -i ogretmenpro-db psql -U postgres -d ogretmenpro

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT NULL;
