import type { ToplamDevamsizlikOgrenciDto } from './dto/toplam-devamsizlik-import.dto';

export function filterToplamDevamsizlikRows(
  rows: ToplamDevamsizlikOgrenciDto[],
  filters: {
    use_ozursuz?: boolean;
    use_ozurlu?: boolean;
    ozursuz_min?: number;
    ozursuz_max?: number;
    ozurlu_min?: number;
    ozurlu_max?: number;
    combine_and?: boolean;
  },
): ToplamDevamsizlikOgrenciDto[] {
  const useOzursuz = filters.use_ozursuz !== false;
  const useOzurlu = filters.use_ozurlu !== false;
  const ozursuzMin = Number(filters.ozursuz_min ?? 0);
  const ozursuzMax = Number(filters.ozursuz_max ?? 180);
  const ozurluMin = Number(filters.ozurlu_min ?? 0);
  const ozurluMax = Number(filters.ozurlu_max ?? 180);
  const combineAnd = filters.combine_and !== false;

  return rows.filter((st) => {
    const ozs = Number(st.ozursuz_gun ?? 0);
    const ozr = Number(st.ozurlu_gun ?? 0);
    const ozsOk = !useOzursuz || (ozs >= ozursuzMin && ozs <= ozursuzMax);
    const ozrOk = !useOzurlu || (ozr >= ozurluMin && ozr <= ozurluMax);
    if (useOzursuz && useOzurlu) return combineAnd ? ozsOk && ozrOk : ozsOk || ozrOk;
    if (useOzursuz) return ozsOk;
    if (useOzurlu) return ozrOk;
    return false;
  });
}

export function toplamDevamsizlikGunLabel(st: ToplamDevamsizlikOgrenciDto): string {
  const parts: string[] = [];
  if (st.ozursuz_gun != null && st.ozursuz_gun > 0) parts.push(`Özürsüz: ${st.ozursuz_gun} gün`);
  if (st.ozurlu_gun != null && st.ozurlu_gun > 0) parts.push(`Özürlü: ${st.ozurlu_gun} gün`);
  return parts.length ? parts.join(', ') : '1 gün';
}

export function toplamDevamsizlikTurLabel(): string {
  return 'Toplam devamsızlık';
}
