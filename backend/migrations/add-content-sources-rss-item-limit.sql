-- İl MEB kaynakları için kaynak başına item limit (örn. 10)
-- Çalıştırma: Get-Content backend/migrations/add-content-sources-rss-item-limit.sql | docker exec -i ogretmenpro-db psql -U postgres -d ogretmenpro

ALTER TABLE content_sources ADD COLUMN IF NOT EXISTS rss_item_limit INT DEFAULT NULL;
