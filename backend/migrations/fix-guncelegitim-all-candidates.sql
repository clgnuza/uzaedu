-- main = sınav görevi listesi (~15), #headline = slayt (yedek). İkisi birlikte ~15+ sınav haberi
UPDATE exam_duty_sync_sources
SET scrape_config = scrape_config - 'container_selector' || '{"container_selector": "main, #headline"}'::jsonb
WHERE key = 'exam_duty_guncelegitim';
