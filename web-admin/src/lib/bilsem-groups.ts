/** Bilsem yetenek alanları – ana grup */
export const BILSEM_ANA_GRUPLAR = [
  { value: 'GENEL_YETENEK', label: 'Genel Yetenek' },
  { value: 'RESIM', label: 'Resim' },
  { value: 'MUZIK', label: 'Müzik' },
  { value: 'DIGERLERI', label: 'Diğerleri' },
] as const;

const ANA_MAP = new Map<string, string>(BILSEM_ANA_GRUPLAR.map((g) => [g.value, g.label]));

export function bilsemAnaGrupLabel(code: string | null | undefined): string {
  if (code == null || String(code).trim() === '') return '—';
  return ANA_MAP.get(code) ?? code;
}

/** Bilsem Ek-1 Program aşamaları – alt grup */
export const BILSEM_ALT_GRUPLAR = [
  { value: 'UYUM', label: 'Uyum' },
  { value: 'DESTEK-1', label: 'Destek-1' },
  { value: 'DESTEK-2', label: 'Destek-2' },
  { value: 'BYF-1', label: 'BYF-1' },
  { value: 'BYF-2', label: 'BYF-2' },
  { value: 'ÖYG-1', label: 'ÖYG-1' },
  { value: 'ÖYG-2', label: 'ÖYG-2' },
  { value: 'ÖYG-3', label: 'ÖYG-3' },
  { value: 'ÖYG-4', label: 'ÖYG-4' },
  { value: 'ÖYG-5', label: 'ÖYG-5' },
  { value: 'ÖYG-6', label: 'ÖYG-6' },
  { value: 'ÖYG-7', label: 'ÖYG-7' },
  { value: 'PROJE', label: 'Proje' },
] as const;
