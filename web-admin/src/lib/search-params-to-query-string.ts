/** App Router `searchParams` kaydını `URLSearchParams.toString()` biçimine çevirir (? yok). */
export function searchParamsRecordToQueryString(
  sp: Record<string, string | string[] | undefined>,
): string | undefined {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      for (const item of v) {
        if (item != null && item !== '') u.append(k, item);
      }
    } else if (v !== '') {
      u.set(k, v);
    }
  }
  const s = u.toString();
  return s || undefined;
}
