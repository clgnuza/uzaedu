-- Kota kaldır: max_process_per_sync ile sırayla 1 işleniyor, kota gereksiz
UPDATE app_config
SET value = (COALESCE(value::jsonb, '{}'::jsonb) || '{"max_new_per_sync": 0}'::jsonb)::text
WHERE key = 'exam_duty_sync_options';
