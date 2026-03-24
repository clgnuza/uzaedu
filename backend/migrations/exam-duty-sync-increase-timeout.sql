-- Sync timeout artırımı: 15s → 30s (Güncelegitim yavaş yanıt veriyor)
-- Çalıştırma: Get-Content -Encoding UTF8 backend/migrations/exam-duty-sync-increase-timeout.sql | docker exec -i ogretmenpro-db env PGCLIENTENCODING=UTF8 psql -U postgres -d ogretmenpro

UPDATE app_config
SET value = (COALESCE(value::jsonb, '{}'::jsonb) || '{"fetch_timeout_ms": 30000}'::jsonb)::text
WHERE key = 'exam_duty_sync_options';
