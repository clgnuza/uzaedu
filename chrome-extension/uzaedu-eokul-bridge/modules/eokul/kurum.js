var UZA_KURUM_STORAGE_KEY = 'uzaKurumKey';

function uzaGetKurumKey() {
  const k = String(globalThis.UZA_ACTIVE_KURUM_KEY || 'ilkOgretim').trim();
  if (k === 'ortaOgretim' || k === 'okulOncesi' || k === 'ilkOgretim') return k;
  return 'ilkOgretim';
}

function uzaDetectKurumFromUrl(url) {
  const u = String(url || '');
  if (/\/OrtaOgretim\//i.test(u)) return 'ortaOgretim';
  if (/\/OkulOncesi\//i.test(u)) return 'okulOncesi';
  if (/\/IlkOgretim\//i.test(u)) return 'ilkOgretim';
  return null;
}

async function uzaLoadKurumKeyFromStorage() {
  const st = await chrome.storage.session.get([UZA_KURUM_STORAGE_KEY]);
  const fromStore = String(st[UZA_KURUM_STORAGE_KEY] || '').trim();
  if (fromStore === 'ortaOgretim' || fromStore === 'ilkOgretim' || fromStore === 'okulOncesi') {
    globalThis.UZA_ACTIVE_KURUM_KEY = fromStore;
    return fromStore;
  }
  globalThis.UZA_ACTIVE_KURUM_KEY = 'ilkOgretim';
  return 'ilkOgretim';
}

async function uzaSaveKurumKey(key) {
  const k =
    key === 'ortaOgretim' ? 'ortaOgretim' : key === 'okulOncesi' ? 'okulOncesi' : 'ilkOgretim';
  globalThis.UZA_ACTIVE_KURUM_KEY = k;
  await chrome.storage.session.set({ [UZA_KURUM_STORAGE_KEY]: k });
  return k;
}

function uzaActiveProfile() {
  return uzaProfileFromBootstrap(uzaGetKurumKey());
}

function uzaDomPick(path) {
  const parts = String(path || '').split('.');
  let cur = globalThis.UZA_BOOTSTRAP_CACHE?.domRuntime;
  for (const p of parts) {
    if (!cur || typeof cur !== 'object') return null;
    cur = cur[p];
  }
  return cur;
}

function uzaMenuSupportsKurum(menuId, kurumKey) {
  const m = globalThis.UZA_EXTENSION_UI?.menus?.[menuId];
  const keys = m?.supportedKurumKeys;
  if (!Array.isArray(keys) || !keys.length) return kurumKey === 'ilkOgretim';
  return keys.includes(kurumKey);
}
