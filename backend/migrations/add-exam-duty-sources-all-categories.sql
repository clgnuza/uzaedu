-- Tüm sınav görevi kategorileri (meb, osym, aof, ataaof, auzef) için kaynakları ekle/güncelle
-- Çalıştırma (UTF-8): Get-Content -Encoding UTF8 backend/migrations/add-exam-duty-sources-all-categories.sql | docker exec -i ogretmenpro-db env PGCLIENTENCODING=UTF8 psql -U postgres -d ogretmenpro

-- MEB Personel GM kaldırıldı (genel personel RSS; sınav görevi/gözetmen duyurusu nadir)
DELETE FROM exam_duty_sync_sources WHERE key = 'exam_duty_meb_personel';

-- Güncel Eğitim (Agregatör) - TÜM kategorilere detect_category_per_item ile dağıtır (meb, osym, aof, ataaof, auzef)
INSERT INTO exam_duty_sync_sources (key, label, category_slug, rss_url, base_url, scrape_config, title_keywords, is_active, sort_order)
VALUES (
  'exam_duty_guncelegitim',
  E'G\u00FCncel E\u011Fitim (Agregat\u00F6r)',
  'meb',
  NULL,
  'https://www.guncelegitim.com',
  '{"list_url":"/haberler/sinav-gorevi/","container_selector":"#headline","item_selector":"a[href*=\"/haber/\"]","link_selector":"a","title_selector":"a","detect_category_per_item":true,"filter_non_application":true,"skip_title_keywords":true,"fetch_article_for_dates":true}'::jsonb,
  E's\u0131nav,g\u00F6rev,g\u00F6zetmen,ba\u015Fvuru,\u00D6SYM,MEB,A\u00D6F,LGS,a\u00E7\u0131k \u00F6\u011Fretim,ATA-A\u00D6F,ATA A\u00D6F,AUZEF',
  true,
  0
) ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  base_url = EXCLUDED.base_url,
  scrape_config = EXCLUDED.scrape_config,
  title_keywords = EXCLUDED.title_keywords,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order;
