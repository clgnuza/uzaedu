export enum DtTeminType {
  // 22/a - Mal Alımı
  TEMIN_22A_MAL = '22a_mal',

  // 22/b - Hizmet Alımı
  TEMIN_22B_HIZMET = '22b_hizmet',

  // 22/c - Yapı İşleri
  TEMIN_22C_YAPIM = '22c_yapim',

  // 22/d - Diğer İşler
  TEMIN_22D_DIG_ISLER = '22d_dig_isler',

  // 22/e - Danışmanlık
  TEMIN_22E_DANISMANLIK = '22e_danismanlik',

  // 22/f - Kirala/Kiralamak
  TEMIN_22F_KIRALA = '22f_kirala',

  // 22/g - İşletme
  TEMIN_22G_ISLETME = '22g_isletme',
}

export const DT_TEMIN_TYPE_LABELS: Record<DtTeminType, { label: string; scope: 'mal' | 'hizmet' | 'yapim' }> = {
  [DtTeminType.TEMIN_22A_MAL]: { label: 'Mal Alımı (22/a)', scope: 'mal' },
  [DtTeminType.TEMIN_22B_HIZMET]: { label: 'Hizmet Alımı (22/b)', scope: 'hizmet' },
  [DtTeminType.TEMIN_22C_YAPIM]: { label: 'Yapı İşleri (22/c)', scope: 'yapim' },
  [DtTeminType.TEMIN_22D_DIG_ISLER]: { label: 'Diğer İşler (22/d)', scope: 'hizmet' },
  [DtTeminType.TEMIN_22E_DANISMANLIK]: { label: 'Danışmanlık (22/e)', scope: 'hizmet' },
  [DtTeminType.TEMIN_22F_KIRALA]: { label: 'Kiralamak (22/f)', scope: 'hizmet' },
  [DtTeminType.TEMIN_22G_ISLETME]: { label: 'İşletme (22/g)', scope: 'hizmet' },
};
