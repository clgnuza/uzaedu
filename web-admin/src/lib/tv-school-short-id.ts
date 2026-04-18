/** UUID ↔ base64url (22 karakter) — TV adresinde `?s=` ile okul kimliği kısaltılır. */

const UUID_HEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuidString(id: string): boolean {
  return UUID_HEX.test(id.trim());
}

function uuidToBytes(uuid: string): Uint8Array | null {
  const hex = uuid.trim().replace(/-/g, '');
  if (!/^[0-9a-f]{32}$/i.test(hex)) return null;
  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  const b64 = btoa(binary);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(s: string): Uint8Array | null {
  let b64 = s.trim().replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  try {
    const binary = atob(b64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function bytesToUuid(bytes: Uint8Array): string | null {
  if (bytes.length !== 16) return null;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  const u = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  return isUuidString(u) ? u : null;
}

/** Geçerli UUID ise 22 karaktere indirger; aksi halde null. */
export function uuidToTvShortSchoolId(uuid: string): string | null {
  if (!isUuidString(uuid)) return null;
  const bytes = uuidToBytes(uuid);
  if (!bytes) return null;
  return bytesToBase64Url(bytes);
}

/** `s` sorgu parametresinden tam UUID; geçersizse null. */
export function uuidFromTvShortSchoolId(short: string): string | null {
  const raw = short.trim();
  if (!raw) return null;
  const bytes = base64UrlToBytes(raw);
  if (!bytes) return null;
  return bytesToUuid(bytes);
}
