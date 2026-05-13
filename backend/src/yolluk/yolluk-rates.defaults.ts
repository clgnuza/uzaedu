/** 2026 H cetveli özeti (1–4: 860, 5–15: 850 TL); `derece_rates_json` ile DB override edilir. */
export const YOLLUK_DEFAULT_DERECE_DAILY_TL: Record<number, number> = {
  1: 860,
  2: 860,
  3: 860,
  4: 860,
  5: 850,
  6: 850,
  7: 850,
  8: 850,
  9: 850,
  10: 850,
  11: 850,
  12: 850,
  13: 850,
  14: 850,
  15: 850,
};

/** Eğitim / API testi — 2026 tipik örnek girdiler (resmi tutarlar `yolluk_global_settings` ile gelir) */
export const YOLLUK_ORNEK_GECICI_2026 = {
  kind: 'gecici' as const,
  mission_days: 7,
  yol_masrafi_tl: 1200,
  konaklama_tl: 0,
  diger_tl: 0,
  tasit_ucreti_tl: 350,
  taksi_tl: 0,
  ek_gosterge_band: 'g3600_6400' as const,
};

export const YOLLUK_ORNEK_SUREKLI_2026 = {
  kind: 'surekli' as const,
  mesafe_km: 120,
  aile_ferdi_sayisi: 2,
  ydm_km_mode: 'tam' as const,
  tasit_ucreti_tl: 200,
  ek_gosterge_band: 'g6400_8000' as const,
};
