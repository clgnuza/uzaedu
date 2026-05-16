-- Sözleşme taslağı (HTML) + yüklenici — dt_files.sozlesme_json
ALTER TABLE dt_files ADD COLUMN IF NOT EXISTS sozlesme_json jsonb NULL;
