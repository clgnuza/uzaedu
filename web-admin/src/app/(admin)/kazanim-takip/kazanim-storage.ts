/** localStorage helpers for Kazanım Takip – favoriler, son planlar, filtreler, kaldığın yer, kazanım durumu */

const STORAGE_FAVORILER = 'kazanim-takip-favoriler';
const STORAGE_SON_PLANLAR = 'kazanim-takip-son';
const STORAGE_FILTRELER = 'kazanim-takip-filtreler';
const STORAGE_KALDIGIN_YER = 'kazanim-takip-kaldigin-yer';
const STORAGE_KAZANIM_DURUM = 'kazanim-takip-kazanim-durum';
const MAX_SON_PLAN = 8;

function isStorageAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

export function getFavoriler(): string[] {
  if (!isStorageAvailable()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_FAVORILER);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setFavoriler(ids: string[]): void {
  if (!isStorageAvailable()) return;
  try {
    localStorage.setItem(STORAGE_FAVORILER, JSON.stringify(ids));
  } catch {}
}

export function toggleFavori(planId: string): void {
  const fav = getFavoriler();
  const idx = fav.indexOf(planId);
  if (idx >= 0) fav.splice(idx, 1);
  else fav.push(planId);
  setFavoriler(fav);
}

export function getSonPlanlar(): { id: string; label: string; visitedAt: string }[] {
  if (!isStorageAvailable()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_SON_PLANLAR);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addSonPlan(planId: string, label: string): void {
  if (!isStorageAvailable()) return;
  try {
    let list = getSonPlanlar();
    list = list.filter((p) => p.id !== planId);
    list.unshift({ id: planId, label, visitedAt: new Date().toISOString() });
    list = list.slice(0, MAX_SON_PLAN);
    localStorage.setItem(STORAGE_SON_PLANLAR, JSON.stringify(list));
  } catch {}
}

/** Kayıtlı filtreler (sınıf, branş, görünüm) */
export type SavedFilters = { filterGrade: number | null; filterSubject: string | null; viewMode: 'sinif' | 'brans' };

export function getSavedFilters(): SavedFilters {
  if (!isStorageAvailable()) return { filterGrade: null, filterSubject: null, viewMode: 'sinif' };
  try {
    const raw = localStorage.getItem(STORAGE_FILTRELER);
    return raw ? JSON.parse(raw) : { filterGrade: null, filterSubject: null, viewMode: 'sinif' };
  } catch {
    return { filterGrade: null, filterSubject: null, viewMode: 'sinif' };
  }
}

export function setSavedFilters(f: SavedFilters): void {
  if (!isStorageAvailable()) return;
  try {
    localStorage.setItem(STORAGE_FILTRELER, JSON.stringify(f));
  } catch {}
}

/** Kaldığın yer (son plan + hafta) */
export function getKaldiginYer(): { planId: string; label: string; week: number } | null {
  if (!isStorageAvailable()) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KALDIGIN_YER);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setKaldiginYer(planId: string, label: string, week: number): void {
  if (!isStorageAvailable()) return;
  try {
    localStorage.setItem(STORAGE_KALDIGIN_YER, JSON.stringify({ planId, label, week }));
  } catch {}
}

/** Kazanım işaretleme: itemId -> tamamlandı (true) / eksik (false) */
export function getKazanimDurum(): Record<string, boolean> {
  if (!isStorageAvailable()) return {};
  try {
    const raw = localStorage.getItem(STORAGE_KAZANIM_DURUM);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setKazanimDurum(itemId: string, tamamlandi: boolean): void {
  if (!isStorageAvailable()) return;
  try {
    const cur = getKazanimDurum();
    cur[itemId] = tamamlandi;
    localStorage.setItem(STORAGE_KAZANIM_DURUM, JSON.stringify(cur));
  } catch {}
}

export function toggleKazanimDurum(itemId: string): boolean {
  const cur = getKazanimDurum();
  const next = !cur[itemId];
  setKazanimDurum(itemId, next);
  return next;
}
