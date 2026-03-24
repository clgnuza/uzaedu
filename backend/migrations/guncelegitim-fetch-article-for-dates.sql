-- Güncel Eğitim: Her haberin detay sayfası çekilir, GPT ile tarih çıkarılır.
-- Slayttaki 15 haber farklı içerik: bazılarında MEB/ÖSYM tablosu (OTURUM, SON İSTEK), bazılarında sadece ücret bilgisi.
-- fetch_article_for_dates=true ile her linkin body'si alınır, GPT doğru tarihleri çıkarır veya null döner.
-- Çalıştırma: Get-Content -Encoding UTF8 backend/migrations/guncelegitim-fetch-article-for-dates.sql | docker exec -i ogretmenpro-db env PGCLIENTENCODING=UTF8 psql -U postgres -d ogretmenpro

UPDATE exam_duty_sync_sources
SET scrape_config = scrape_config || '{"fetch_article_for_dates": true}'::jsonb
WHERE key = 'exam_duty_guncelegitim';
