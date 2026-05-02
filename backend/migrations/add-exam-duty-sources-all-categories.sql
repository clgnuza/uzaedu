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

-- ÖğretmenX (ikincil): /arama haber listesi + agregatörle gövde URL örtüşmesinde atlama
INSERT INTO exam_duty_sync_sources (key, label, category_slug, rss_url, base_url, scrape_config, title_keywords, is_active, sort_order)
VALUES (
  'exam_duty_ogretmenx',
  E'\u00D6\u011FretmenX (Arama: s\u0131nav g\u00F6revi)',
  'meb',
  NULL,
  'https://www.ogretmenx.com',
  '{"list_url":"/arama?q=s%C4%B1nav+g%C3%B6revi&type=post","container_selector":".result-category","item_selector":".col-lg-6.border-bottom","link_selector":"a.d-block","title_selector":"h4.title-2-line","detect_category_per_item":true,"filter_non_application":true,"skip_title_keywords":true,"fetch_article_for_dates":true,"dedupe_skip_if_body_links_match_existing_source_url":true,"dedupe_match_primary_headlines_against_source_keys":["exam_duty_guncelegitim"],"dedupe_application_end_slack_days":2,"dedupe_exam_range_pad_days":1,"latest_content_check_limit":20,"force_title_keyword_filter":true}'::jsonb,
  E's\u0131nav,g\u00F6rev,g\u00F6zetmen,ba\u015Fvuru,\u00D6SYM,MEB,A\u00D6F,LGS,g\u00F6revlendirme',
  true,
  1
) ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  base_url = EXCLUDED.base_url,
  scrape_config = EXCLUDED.scrape_config,
  title_keywords = EXCLUDED.title_keywords,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order;
