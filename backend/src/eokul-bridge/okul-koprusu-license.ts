export const OKUL_KOPRUSU_MODULE = 'okul_koprusu';

export type OkulKoprusuTier = 'free' | 'paid';

export type OkulKoprusuLicense = {
  code: string;
  tier: OkulKoprusuTier;
  active: boolean;
  createdAt?: string;
  expiresAt?: string | null;
};

export function normalizeOkulKoprusuCode(raw: string): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

export function generateOkulKoprusuCode(): string {
  const part = () =>
    Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase()
      .padEnd(4, '0')
      .slice(0, 4);
  return `UZA-${part()}-${part()}`;
}

export function maskOkulKoprusuCode(code: string): string {
  const n = normalizeOkulKoprusuCode(code);
  if (n.length < 10) return 'UZA-****-****';
  return `${n.slice(0, 7)}****-${n.slice(-4)}`;
}

export function isOkulKoprusuModuleEnabled(enabledModules: string[] | null | undefined): boolean {
  if (!enabledModules || enabledModules.length === 0) return true;
  return enabledModules.includes(OKUL_KOPRUSU_MODULE);
}

export function isLicenseRecordValid(lic: OkulKoprusuLicense | null | undefined): boolean {
  if (!lic?.active || !lic.code) return false;
  if (lic.expiresAt) {
    const exp = new Date(lic.expiresAt).getTime();
    if (!Number.isNaN(exp) && exp < Date.now()) return false;
  }
  return true;
}

export function codesMatch(stored: string, provided: string): boolean {
  return normalizeOkulKoprusuCode(stored) === normalizeOkulKoprusuCode(provided);
}
