-- max_new_per_sync varsayılan 1: Her sync'te en fazla 1 yeni duyuru (created + restored)
UPDATE app_config
SET value = (COALESCE(value::jsonb, '{}'::jsonb) || '{"max_new_per_sync": 1}'::jsonb)::text
WHERE key = 'exam_duty_sync_options'
  AND COALESCE((value::jsonb->>'max_new_per_sync')::int, 0) = 0;
