import { apiFetch } from '@/lib/api';

export type EokulBridgeStatus = {
  ok: boolean;
  extensionEnabled: boolean;
  minExtensionVersion: string;
  portalOrigin: string;
  user: { id?: string; school_id?: string | null; role?: string | null } | null;
};

export type EokulBridgeMenu = {
  label: string;
  description?: string;
  phase: number;
  direction: string;
  panelPath?: string | null;
  enabled: boolean;
  supportedKurumKeys?: string[];
};

export type EokulBridgeBootstrap = {
  minExtensionVersion: string;
  extensionEnabled: boolean;
  menuIds: string[];
  extensionUi?: {
    menus?: Record<string, EokulBridgeMenu>;
  };
  menusMeta?: Record<string, { supportedKurumKeys?: string[] }>;
};

export function fetchEokulBridgeStatus(token: string | null) {
  return apiFetch<EokulBridgeStatus>('/eokul-bridge/v1/status', { token });
}

export function fetchEokulBridgeBootstrap(token: string | null) {
  return apiFetch<EokulBridgeBootstrap>('/eokul-bridge/v1/bootstrap', { token });
}

export type EokulBridgeSchoolAccess = {
  ok: boolean;
  moduleKey: string;
  moduleEnabled: boolean;
  tier: 'free' | 'paid' | null;
  licenseActive: boolean;
  requiresCode: boolean;
  canUseBridge: boolean;
  codeMasked: string | null;
  marketHref: string;
  message?: string;
  school: {
    id: string;
    name: string;
    city: string | null;
    district: string | null;
    institutionCode: string | null;
    status: string;
  } | null;
};

export type EokulBridgeSchoolAccessAdmin = EokulBridgeSchoolAccess & {
  code: string | null;
  license: {
    code: string;
    tier: 'free' | 'paid';
    active: boolean;
    expiresAt?: string | null;
  } | null;
};

export function fetchEokulBridgeSchoolAccess(token: string | null) {
  return apiFetch<EokulBridgeSchoolAccess>('/eokul-bridge/v1/school-access', { token });
}

export function fetchEokulBridgeSchoolAccessAdmin(token: string | null) {
  return apiFetch<EokulBridgeSchoolAccessAdmin>('/eokul-bridge/v1/school-access/admin', { token });
}

export function regenerateEokulBridgeSchoolCode(
  token: string | null,
  tier: 'free' | 'paid' = 'paid',
) {
  return apiFetch<EokulBridgeSchoolAccessAdmin & { code: string }>(
    '/eokul-bridge/v1/school-access/regenerate',
    { token, method: 'POST', body: { tier } },
  );
}

export function patchEokulBridgeSchoolLicense(
  token: string | null,
  body: { tier?: 'free' | 'paid'; active?: boolean },
) {
  return apiFetch<EokulBridgeSchoolAccessAdmin>('/eokul-bridge/v1/school-access/patch', {
    token,
    method: 'POST',
    body,
  });
}
