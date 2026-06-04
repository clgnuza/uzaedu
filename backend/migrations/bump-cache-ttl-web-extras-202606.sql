-- web_extras_config: API + Next fetch önbelleği (düşükse 300 sn yap)
UPDATE app_config
SET value = (value::jsonb || '{"cache_ttl_web_extras":300}'::jsonb)::text
WHERE key = 'web_extras_config'
  AND COALESCE((value::jsonb->>'cache_ttl_web_extras')::int, 0) < 300;
