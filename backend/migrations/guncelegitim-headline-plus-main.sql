-- Güncel Eğitim: 15 kart (#headline) + ana liste (main) birlikte taranır.
-- Böylece sadece ana listede görünen sınav duyuruları (örn. MEB 3 oturum) da aday listesine girer.
-- İçerikte sınav duyurusu varsa atlama yapılmaz (backend: bodyOrTitleSuggestsExamAnnouncement).
-- Çalıştırma: Get-Content -Encoding UTF8 backend/migrations/guncelegitim-headline-plus-main.sql | docker exec -i ogretmenpro-db env PGCLIENTENCODING=UTF8 psql -U postgres -d ogretmenpro

UPDATE exam_duty_sync_sources
SET scrape_config = scrape_config || '{"container_selector": "#headline, main"}'::jsonb
WHERE key = 'exam_duty_guncelegitim';
