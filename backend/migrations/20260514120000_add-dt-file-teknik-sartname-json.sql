ALTER TABLE dt_files
  ADD COLUMN IF NOT EXISTS teknik_sartname_json jsonb;
