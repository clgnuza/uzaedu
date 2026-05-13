-- Ek gösterge bant gündelikleri + denetim gün tavanı
ALTER TABLE yolluk_global_settings
  ADD COLUMN IF NOT EXISTS ek_gosterge_rates_json jsonb,
  ADD COLUMN IF NOT EXISTS denetim_mission_day_cap int NOT NULL DEFAULT 30;
