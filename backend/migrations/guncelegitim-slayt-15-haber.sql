-- Güncel Eğitim: Sadece slayt alanındaki ~15 haber taranır (#headline = SONDAKİKA slaytı).
-- Ana liste (main) kaldırıldı; silinen duyurular sync ile tekrar yüklenebilir (restore).
-- Çalıştırma: Get-Content -Encoding UTF8 backend/migrations/guncelegitim-slayt-15-haber.sql | docker exec -i ogretmenpro-db env PGCLIENTENCODING=UTF8 psql -U postgres -d ogretmenpro

UPDATE exam_duty_sync_sources
SET scrape_config = scrape_config || '{"container_selector": "#headline"}'::jsonb
WHERE key = 'exam_duty_guncelegitim';
