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
