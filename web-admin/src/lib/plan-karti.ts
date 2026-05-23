/** Plan Kartı — planlama ilişkileri markası (özgün terim) */

export const PLAN_KARTI_LABEL = 'Plan Kartı';
export const PLAN_KARTI_LABEL_PLURAL = 'Plan Kartları';

export function relationKartKodu(def: { kart_kodu?: string } | undefined): string | undefined {
  const k = def?.kart_kodu?.trim();
  return k || undefined;
}

export function kartKoduPrefix(def: { kart_kodu?: string } | undefined): string {
  const k = relationKartKodu(def);
  return k ? `${k} · ` : '';
}
