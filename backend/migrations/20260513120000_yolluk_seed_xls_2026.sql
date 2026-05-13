-- Kaynak: 7567 sayılı 2026 Merkezi Yönetim Bütçe Kanunu eki H Cetveli (SBB PDF); ek gösterge 890/880/870; kadro 1–4: 860, 5–15: 850 TL
INSERT INTO yolluk_global_settings (
  fiscal_year,
  default_daily_tl,
  km_daily_fraction,
  memur_fixed_multiplier,
  aile_per_multiplier,
  aile_fixed_cap_multiplier,
  rules_version,
  derece_rates_json,
  ek_gosterge_rates_json,
  denetim_mission_day_cap
)
VALUES (
  2026,
  '850.00',
  '0.05000',
  20,
  10,
  40,
  '2026-H-cetveli-7567',
  '{"1":860,"2":860,"3":860,"4":860,"5":850,"6":850,"7":850,"8":850,"9":850,"10":850,"11":850,"12":850,"13":850,"14":850,"15":850}'::jsonb,
  '{"g8000_ust":890,"g6400_8000":880,"g3600_6400":870,"alt3600":850}'::jsonb,
  30
)
ON CONFLICT (fiscal_year) DO UPDATE SET
  default_daily_tl = EXCLUDED.default_daily_tl,
  km_daily_fraction = EXCLUDED.km_daily_fraction,
  memur_fixed_multiplier = EXCLUDED.memur_fixed_multiplier,
  aile_per_multiplier = EXCLUDED.aile_per_multiplier,
  aile_fixed_cap_multiplier = EXCLUDED.aile_fixed_cap_multiplier,
  rules_version = EXCLUDED.rules_version,
  derece_rates_json = EXCLUDED.derece_rates_json,
  ek_gosterge_rates_json = EXCLUDED.ek_gosterge_rates_json,
  denetim_mission_day_cap = EXCLUDED.denetim_mission_day_cap,
  updated_at = now();
