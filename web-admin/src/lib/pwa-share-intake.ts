const TEXT_KEY = 'pwa-share-text-v1';
const TARGET_KEY = 'pwa-share-target-v1';
const DB_NAME = 'uzaedu-share-files-v1';
const STORE = 'blobs';

export type ShareTextPayload = {
  title?: string;
  text?: string;
  url?: string;
  at: number;
};

export type ShareTargetModule = 'optik' | 'evrak' | 'mesaj';

type StoredFile = { name: string; type: string; blob: Blob };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function saveShareText(payload: { title?: string; text?: string; url?: string }): void {
  try {
    const row: ShareTextPayload = { ...payload, at: Date.now() };
    sessionStorage.setItem(TEXT_KEY, JSON.stringify(row));
  } catch {
    /* ignore */
  }
}

export function peekShareText(maxAgeMs = 30 * 60 * 1000): ShareTextPayload | null {
  try {
    const raw = sessionStorage.getItem(TEXT_KEY);
    if (!raw) return null;
    const row = JSON.parse(raw) as ShareTextPayload;
    if (Date.now() - row.at > maxAgeMs) return null;
    return row;
  } catch {
    return null;
  }
}

export function clearShareText(): void {
  try {
    sessionStorage.removeItem(TEXT_KEY);
  } catch {
    /* ignore */
  }
}

export function setShareTarget(module: ShareTargetModule): void {
  try {
    sessionStorage.setItem(TARGET_KEY, module);
  } catch {
    /* ignore */
  }
}

export function takeShareTarget(): ShareTargetModule | null {
  try {
    const v = sessionStorage.getItem(TARGET_KEY) as ShareTargetModule | null;
    sessionStorage.removeItem(TARGET_KEY);
    return v;
  } catch {
    return null;
  }
}

export async function saveShareFiles(files: File[]): Promise<void> {
  if (!files.length) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    store.clear();
    files.forEach((f, i) => {
      const row: StoredFile & { id: string } = {
        id: String(i),
        name: f.name,
        type: f.type,
        blob: f,
      };
      store.put(row);
    });
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function peekShareFiles(): Promise<File[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => {
      const rows = (req.result as (StoredFile & { id: string })[]) ?? [];
      resolve(rows.map((r) => new File([r.blob], r.name, { type: r.type })));
    };
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export async function clearShareFiles(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function takeShareFiles(): Promise<File[]> {
  const files = await peekShareFiles();
  await clearShareFiles();
  return files;
}

export function classifyShareFiles(files: File[]): 'image' | 'pdf' | 'mixed' | 'other' {
  let img = 0;
  let pdf = 0;
  for (const f of files) {
    if (f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(f.name)) img += 1;
    else if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) pdf += 1;
  }
  if (img && pdf) return 'mixed';
  if (img) return 'image';
  if (pdf) return 'pdf';
  return 'other';
}
