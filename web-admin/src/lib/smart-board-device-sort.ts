/** Akıllı tahta cihaz listesi: sınıf → ad (artan, sayısal). */
export function compareSmartBoardDevices(
  a: { name?: string | null; classSection?: string | null },
  b: { name?: string | null; classSection?: string | null },
): number {
  const byClass = (a.classSection ?? '').localeCompare(b.classSection ?? '', 'tr', { numeric: true });
  if (byClass !== 0) return byClass;
  return (a.name ?? '').localeCompare(b.name ?? '', 'tr', { numeric: true });
}

export function sortSmartBoardDevices<T extends { name?: string | null; classSection?: string | null }>(
  list: T[],
): T[] {
  return [...list].sort(compareSmartBoardDevices);
}

/** Yalnız tahta adına göre (artan, sayısal). */
export function compareSmartBoardDevicesByName(
  a: { name?: string | null },
  b: { name?: string | null },
): number {
  return (a.name ?? '').localeCompare(b.name ?? '', 'tr', { numeric: true });
}

export function sortSmartBoardDevicesByName<T extends { name?: string | null }>(list: T[]): T[] {
  return [...list].sort(compareSmartBoardDevicesByName);
}
