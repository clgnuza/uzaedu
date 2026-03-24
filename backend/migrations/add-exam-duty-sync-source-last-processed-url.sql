-- max_process_per_sync ile sırayla işleme: son işlenen URL kaydedilir, bir sonraki sync'te ondan sonraki işlenir
ALTER TABLE exam_duty_sync_sources ADD COLUMN IF NOT EXISTS last_processed_url TEXT;
