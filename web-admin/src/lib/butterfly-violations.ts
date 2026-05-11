/** `POST .../generate-seats` yanıtındaki ihlal sayaçları (backend ile uyumlu) */
export type ButterflyViolations = {
  adjacent: number;
  skipOne: number;
  gender?: number;
  classMix?: number;
  backToBack?: number;
  cross?: number;
  pairRow?: number;
  fixedRoom?: number;
};

export function butterflyViolationTotal(v: ButterflyViolations): number {
  return (
    (v.adjacent ?? 0) +
    (v.skipOne ?? 0) +
    (v.gender ?? 0) +
    (v.classMix ?? 0) +
    (v.backToBack ?? 0) +
    (v.cross ?? 0) +
    (v.pairRow ?? 0) +
    (v.fixedRoom ?? 0)
  );
}

export function butterflyViolationSummary(v: ButterflyViolations): string {
  const parts: string[] = [];
  if (v.adjacent) parts.push(`aynı sınıf bitişik ${v.adjacent}`);
  if (v.skipOne) parts.push(`aynı sınıf arada bir ${v.skipOne}`);
  if (v.gender) parts.push(`cinsiyet ${v.gender}`);
  if (v.classMix) parts.push(`sınıf karışımı ${v.classMix}`);
  if (v.backToBack) parts.push(`arka arkaya ${v.backToBack}`);
  if (v.cross) parts.push(`çapraz ${v.cross}`);
  if (v.pairRow) parts.push(`ikili sıra ${v.pairRow}`);
  if (v.fixedRoom) parts.push(`sabit salon ${v.fixedRoom}`);
  return parts.length ? parts.join(' · ') : '';
}
