/**
 * HttpOnly çerez (özellikle Firefox çapraz site) yoksa kısa ömürlü Bearer yedek.
 * localStorage kullanılmaz; sekme kapanınca sessionStorage silinir.
 */
const KEY = 'ogp_bearer';

let memory: string | null = null;

export function setSessionBearer(token: string | null): void {
  memory = token;
  try {
    if (typeof window === 'undefined') return;
    if (token) sessionStorage.setItem(KEY, token);
    else sessionStorage.removeItem(KEY);
  } catch {
    /* gizli mod */
  }
}

export function getSessionBearer(): string | null {
  if (memory) return memory;
  try {
    if (typeof window === 'undefined') return null;
    const v = sessionStorage.getItem(KEY);
    memory = v;
    return v;
  } catch {
    return null;
  }
}

export function clearSessionBearer(): void {
  setSessionBearer(null);
}
