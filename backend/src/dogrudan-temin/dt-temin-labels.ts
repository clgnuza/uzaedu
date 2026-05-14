/** KİK 22 — mutemet / HYS dışa aktarımında kullanılacak kısa Türkçe açıklamalar */
export const DT_TEMIN_TYPE_TR: Record<string, string> = {
  '22a_mal': 'Mal alımı (22/a)',
  '22b_hizmet': 'Hizmet alımı (22/b)',
  '22c_yapim': 'Yapım işleri (22/c)',
  '22d_dig_isler': 'Diğer işler (22/d)',
  '22e_danismanlik': 'Danışmanlık (22/e)',
  '22f_kirala': 'Kiralama (22/f)',
  '22g_isletme': 'İşletme (22/g)',
};

export function dtTeminTypeTr(code: string | null | undefined): string {
  if (!code) return '';
  return DT_TEMIN_TYPE_TR[code] ?? code;
}

const FILE_ST: Record<string, string> = {
  draft: 'Taslak',
  decision: 'Karar aşaması',
  awarded: 'Kararlandı',
};

export function dtFileStatusTr(status: string | null | undefined): string {
  if (!status) return '';
  const k = status.trim().toLowerCase();
  return FILE_ST[k] ?? status;
}
