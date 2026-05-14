/** Evrak defteri aşamaları (BEkSaR ile uyumlu anahtarlar) */
export const DT_REGISTRY_STAGES = [
  'ihtiyac_listesi',
  'komisyon_onay',
  'fiyat_arastirma',
  'yaklasik_maliyet',
  'ihale_onay',
  'teklif_mektubu',
  'piyasa_arastirma',
  'muayene_kabul',
] as const;
export type DtRegistryStage = (typeof DT_REGISTRY_STAGES)[number];

/** Komisyon türleri */
export const DT_COMMISSION_KINDS = ['yaklasik_maliyet', 'piyasa_satinalma', 'muayene_kabul'] as const;
export type DtCommissionKind = (typeof DT_COMMISSION_KINDS)[number];

export const DT_QUOTE_PURPOSES = ['bid', 'market_research'] as const;
export type DtQuotePurpose = (typeof DT_QUOTE_PURPOSES)[number];
