-- Sınav görevi: Güncel Eğitim agregatör kaynağı + GPT ayarı
-- Agregatör: MEB, ÖSYM, AÖF vb. tüm sınav görevi haberleri tek sayfada
-- Çalıştırma (UTF-8 zorunlu, Türkçe karakter için):
--   Get-Content -Encoding UTF8 backend/migrations/add-exam-duty-guncelegitim-source.sql | docker exec -i ogretmenpro-db env PGCLIENTENCODING=UTF8 psql -U postgres -d ogretmenpro

INSERT INTO exam_duty_sync_sources (key, label, category_slug, base_url, scrape_config, title_keywords, is_active, sort_order)
VALUES (
  'exam_duty_guncelegitim',
  'Güncel Eğitim (Agregatör)',
  'meb',
  'https://www.guncelegitim.com',
  '{"list_url":"/haberler/sinav-gorevi/","container_selector":"#headline","item_selector":"a[href*=\"/haber/\"]","link_selector":"a","title_selector":"a","detect_category_per_item":true,"filter_non_application":true}'::jsonb,
  'sınav,görev,gözetmen,başvuru,ÖSYM,MEB,AÖF,LGS,açık öğretim',
  true,
  1
) ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  title_keywords = EXCLUDED.title_keywords,
  scrape_config = EXCLUDED.scrape_config;

-- GPT ile tarih/link çıkarma ayarı (RSS kaynakları için)
INSERT INTO app_config (key, value) VALUES ('exam_duty_gpt_enabled', 'false')
ON CONFLICT (key) DO NOTHING;
