/**
 * Google Drive — yedek JSON yükleme / listeleme / indirme (tarayıcı, OAuth).
 * GCP: OAuth 2.0 Web istemci + Drive API açık olmalı.
 * Kapsam: drive.file (yalnızca uygulamanın oluşturduğu dosyalar)
 */

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (resp: {
              access_token?: string;
              error?: string;
              expires_in?: number;
            }) => void;
          }) => { requestAccessToken: (opts?: { prompt?: string }) => void };
        };
      };
    };
  }
}

let accessTokenCache: { token: string; expiresAt: number } | null = null;

export function getGoogleDriveClientId(): string | null {
  const id = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID?.trim();
  return id || null;
}

export function isGoogleDriveBackupConfigured(): boolean {
  return !!getGoogleDriveClientId();
}

export function invalidateDriveAccessTokenCache(): void {
  accessTokenCache = null;
}

export function loadGoogleIdentityScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Google Identity script yüklenemedi'));
    document.head.appendChild(s);
  });
}

function parseDriveErrorBody(text: string): string {
  try {
    const j = JSON.parse(text) as { error?: { message?: string; errors?: { message?: string }[] } };
    const msg = j.error?.message ?? j.error?.errors?.[0]?.message;
    if (msg) return msg;
  } catch {
    /* ignore */
  }
  return text.length > 200 ? `${text.slice(0, 200)}…` : text;
}

/**
 * Önbellekte geçerli token varsa döner; yoksa hesap seçimi (popup) ile yeni token alır.
 * Aynı oturumda liste + indir tek izin penceresiyle çalışır.
 */
export async function getDriveAccessToken(): Promise<string> {
  const skewMs = 120_000;
  if (accessTokenCache && Date.now() < accessTokenCache.expiresAt - skewMs) {
    return accessTokenCache.token;
  }

  await loadGoogleIdentityScript();
  const clientId = getGoogleDriveClientId();
  if (!clientId) throw new Error('NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID tanımlı değil.');

  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (resp) => {
        if (resp.error) {
          invalidateDriveAccessTokenCache();
          reject(new Error(resp.error === 'access_denied' ? 'İzin verilmedi' : resp.error));
          return;
        }
        if (!resp.access_token) {
          reject(new Error('Token alınamadı'));
          return;
        }
        const sec = resp.expires_in ?? 3599;
        accessTokenCache = {
          token: resp.access_token,
          expiresAt: Date.now() + Math.max(60, sec) * 1000,
        };
        resolve(resp.access_token);
      },
    });
    client.requestAccessToken();
  });
}

/** @deprecated getDriveAccessToken kullanın */
export async function requestDriveAccessToken(): Promise<string> {
  return getDriveAccessToken();
}

export async function uploadJsonToDrive(
  accessToken: string,
  filename: string,
  jsonBody: string,
): Promise<{ id: string; name: string }> {
  const boundary = `ogretmenpro_${Math.random().toString(36).slice(2)}`;
  const meta = { name: filename, mimeType: 'application/json' };
  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(meta) +
    `\r\n--${boundary}\r\n` +
    'Content-Type: application/json\r\n\r\n' +
    jsonBody +
    `\r\n--${boundary}--`;

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(parseDriveErrorBody(t) || `Drive yükleme ${res.status}`);
  }
  return res.json() as Promise<{ id: string; name: string }>;
}

export type DriveBackupFile = {
  id: string;
  name: string;
  modifiedTime?: string;
  size?: string;
  mimeType?: string;
};

/** İsim eşleşmesi + JSON (mime veya .json uzantısı) */
export async function listOgretmenProBackups(accessToken: string): Promise<DriveBackupFile[]> {
  const q = encodeURIComponent("name contains 'ogretmenpro-yedek' and trashed = false");
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime,size,mimeType)&orderBy=modifiedTime desc&pageSize=100`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(parseDriveErrorBody(t) || `Drive liste ${res.status}`);
  }
  const data = (await res.json()) as { files?: DriveBackupFile[] };
  const files = data.files ?? [];
  return files.filter(
    (f) =>
      f.mimeType === 'application/json' ||
      (f.name?.toLowerCase().endsWith('.json') ?? false),
  );
}

export async function downloadDriveFileAsText(accessToken: string, fileId: string): Promise<string> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(parseDriveErrorBody(t) || `Drive indirme ${res.status}`);
  }
  return res.text();
}

/** Token önbelleği + süresi dolmuşsa bir kez yenileme */
export async function downloadDriveFileAsTextReliable(fileId: string): Promise<string> {
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`;
  let token = await getDriveAccessToken();
  let res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) {
    invalidateDriveAccessTokenCache();
    token = await getDriveAccessToken();
    res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  }
  if (!res.ok) {
    const t = await res.text();
    throw new Error(parseDriveErrorBody(t) || `Drive indirme ${res.status}`);
  }
  return res.text();
}
