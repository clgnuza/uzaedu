-- Son başvuru (application_end) varsayılan saati 23:59 (son gün için)
-- Çalıştırma: Get-Content -Encoding UTF8 backend/migrations/exam-duty-application-end-default-2359.sql | docker exec -i ogretmenpro-db env PGCLIENTENCODING=UTF8 psql -U postgres -d ogretmenpro

INSERT INTO app_config (key, value)
SELECT 'exam_duty_default_times', '{"application_start":"00:00","application_end":"23:59","application_approval_end":"00:00","result_date":"00:00","exam_date":"00:00","exam_date_end":"00:00"}'
WHERE NOT EXISTS (SELECT 1 FROM app_config WHERE key = 'exam_duty_default_times');

UPDATE app_config
SET value = (COALESCE(value::jsonb, '{}'::jsonb) || '{"application_end": "23:59"}'::jsonb)::text
WHERE key = 'exam_duty_default_times'
  AND (value IS NULL OR value::jsonb->>'application_end' IS NULL OR value::jsonb->>'application_end' != '23:59');
