-- Güncel Eğitim: skip_title_keywords + fetch_article_for_dates (tarih/başvuru URL çıkarma)
-- Çalıştırma: Get-Content -Encoding UTF8 backend/migrations/exam-duty-guncelegitim-skip-title-keywords.sql | docker exec -i ogretmenpro-db env PGCLIENTENCODING=UTF8 psql -U postgres -d ogretmenpro

UPDATE exam_duty_sync_sources
SET scrape_config = scrape_config || '{"skip_title_keywords": true, "fetch_article_for_dates": true}'::jsonb
WHERE key = 'exam_duty_guncelegitim';
