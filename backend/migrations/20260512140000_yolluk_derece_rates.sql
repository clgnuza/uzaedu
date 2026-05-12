ALTER TABLE yolluk_global_settings
  ADD COLUMN IF NOT EXISTS derece_rates_json jsonb;
