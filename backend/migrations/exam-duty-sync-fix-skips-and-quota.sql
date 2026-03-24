-- Yanlış atlama: tarihsiz başvuru duyuruları taslak olarak eklensin (add_draft_without_dates=true)
-- Her sync'te 1 haber: max_new_per_sync=1, guncelegitim slider_item_limit=1
-- Çalıştırma: Get-Content -Encoding UTF8 backend/migrations/exam-duty-sync-fix-skips-and-quota.sql | docker exec -i ogretmenpro-db env PGCLIENTENCODING=UTF8 psql -U postgres -d ogretmenpro

-- Sync seçenekleri: tarihsiz taslak ekle + kota 1
INSERT INTO app_config (key, value)
SELECT 'exam_duty_sync_options', '{"skip_past_exam_date":false,"recheck_max_count":1,"fetch_timeout_ms":30000,"log_gpt_usage":false,"add_draft_without_dates":true,"max_new_per_sync":0}'
WHERE NOT EXISTS (SELECT 1 FROM app_config WHERE key = 'exam_duty_sync_options');

UPDATE app_config
SET value = (COALESCE(value::jsonb, '{}'::jsonb) || '{"add_draft_without_dates": true, "fetch_timeout_ms": 30000}'::jsonb)::text
WHERE key = 'exam_duty_sync_options';

-- Güncel Eğitim: 15 aday toplanır, her sync'te sırayla 1 işlenir (eklenir veya atlanır)
UPDATE exam_duty_sync_sources
SET scrape_config = scrape_config - 'slider_item_limit' || '{"max_process_per_sync": 1}'::jsonb
WHERE key = 'exam_duty_guncelegitim';
