/**
 * localStorage erişimi – tarayıcı eklentileri, iframe veya gizlilik ayarları
 * nedeniyle "Access to storage is not allowed from this context" hatası
 * oluşabilir. Bu yardımcılar hiçbir zaman throw etmez.
 */
function safeOp<T>(fn: () => T, fallback: T): T {
  try {
    if (typeof window === 'undefined') return fallback;
    return fn();
  } catch {
    return fallback;
  }
}

export function safeStorageGetItem(key: string): string | null {
  return safeOp(() => window.localStorage.getItem(key), null);
}

export function safeStorageSetItem(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
  } catch {
    /* storage engelli */
  }
}

export function safeStorageRemoveItem(key: string): void {
  try {
    if (typeof window !== 'undefined') window.localStorage.removeItem(key);
  } catch {
    /* storage engelli */
  }
}
