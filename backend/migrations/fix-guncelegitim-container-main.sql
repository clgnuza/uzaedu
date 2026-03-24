-- Güncel Eğitim: #headline = SONDAKİKA (genel gündem, sınav görevi değil).
-- Asıl sınav görevi listesi "main" bölümünde. container_selector=main ile doğru linkler taranır.
-- article_body_selector: ana içerik önce (.haber-detay, main .content) - sidebar/ilgili haberler karışmasın.
-- Çalıştırma: Get-Content -Encoding UTF8 backend/migrations/fix-guncelegitim-container-main.sql | docker exec -i ogretmenpro-db env PGCLIENTENCODING=UTF8 psql -U postgres -d ogretmenpro

UPDATE exam_duty_sync_sources
SET scrape_config = scrape_config - 'container_selector' - 'article_body_selector' - 'slider_item_limit' || '{"container_selector": "main, .content", "article_body_selector": ".haber-detay, .haber-content, main .content, .post-content, article", "max_process_per_sync": 1}'::jsonb
WHERE key = 'exam_duty_guncelegitim';
