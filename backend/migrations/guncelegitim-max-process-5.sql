-- Her sync'te 5 haber işlensin (15 için 3 sync yeter)
UPDATE exam_duty_sync_sources
SET scrape_config = scrape_config || '{"max_process_per_sync": 5}'::jsonb
WHERE key = 'exam_duty_guncelegitim';
