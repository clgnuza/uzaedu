import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
} from '@simplewebauthn/browser';
import { apiFetch } from './api';
import { getWebAuthnErrorMessage, type WebAuthnErrorContext } from './webauthn-error-message';

async function wrapWebAuthn<T>(context: WebAuthnErrorContext, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    throw new Error(getWebAuthnErrorMessage(e, context));
  }
}

export type AuthPortal = 'teacher' | 'school';

export const LAST_LOGIN_EMAIL_KEY = 'uzaedu_last_login_email';

const PASSKEY_HINT_PREFIX = 'uzaedu_passkey_hint_';

let supportedCache: boolean | null = null;
let supportedInflight: Promise<boolean> | null = null;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isWebAuthnAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  return window.isSecureContext && browserSupportsWebAuthn();
}

export function rememberLoginEmail(email: string): void {
  try {
    localStorage.setItem(LAST_LOGIN_EMAIL_KEY, email.trim().toLowerCase());
  } catch {
    /* ignore */
  }
}

export function getRememberedLoginEmail(): string {
  try {
    return localStorage.getItem(LAST_LOGIN_EMAIL_KEY) ?? '';
  } catch {
    return '';
  }
}

export function getPasskeyHint(portal: AuthPortal): string {
  try {
    return localStorage.getItem(`${PASSKEY_HINT_PREFIX}${portal}`) ?? '';
  } catch {
    return '';
  }
}

export function setPasskeyHint(portal: AuthPortal, email: string): void {
  try {
    const e = normalizeEmail(email);
    if (e) localStorage.setItem(`${PASSKEY_HINT_PREFIX}${portal}`, e);
  } catch {
    /* ignore */
  }
}

export function hasPasskeyHint(portal: AuthPortal, email?: string): boolean {
  const hint = getPasskeyHint(portal);
  if (!hint) return false;
  if (!email?.trim()) return true;
  return hint === normalizeEmail(email);
}

export function clearPasskeyHint(portal: AuthPortal): void {
  try {
    localStorage.removeItem(`${PASSKEY_HINT_PREFIX}${portal}`);
  } catch {
    /* ignore */
  }
}

export async function fetchWebAuthnSupported(): Promise<boolean> {
  if (!isWebAuthnAvailable()) return false;
  if (supportedCache !== null) return supportedCache;
  if (!supportedInflight) {
    supportedInflight = apiFetch<{ supported: boolean }>('/auth/webauthn/supported')
      .then((r) => {
        supportedCache = r.supported && isWebAuthnAvailable();
        return supportedCache;
      })
      .catch(() => false)
      .finally(() => {
        supportedInflight = null;
      });
  }
  return supportedInflight;
}

export async function hasPasskeyForEmail(email: string, portal: AuthPortal): Promise<boolean> {
  const e = email.trim();
  if (!e) return false;
  try {
    const q = new URLSearchParams({ email: e, portal });
    const r = await apiFetch<{ available: boolean }>(`/auth/webauthn/has-credentials?${q}`);
    return r.available;
  } catch {
    return false;
  }
}

export async function loginWithPasskey(
  email: string,
  portal: AuthPortal,
  rememberMe?: boolean,
): Promise<{ token: string }> {
  return wrapWebAuthn('login', async () => {
    const options = await apiFetch('/auth/webauthn/login/options', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim(), portal }),
    });
    const assertion = await startAuthentication({
      optionsJSON: options as Parameters<typeof startAuthentication>[0]['optionsJSON'],
    });
    const result = await apiFetch<{ token: string }>('/auth/webauthn/login/verify', {
      method: 'POST',
      body: JSON.stringify({
        email: email.trim(),
        portal,
        response: assertion,
        remember_me: rememberMe === true,
      }),
    });
    setPasskeyHint(portal, email);
    return result;
  });
}

export async function registerPasskey(token: string, name?: string, portal?: AuthPortal): Promise<void> {
  return wrapWebAuthn('register', async () => {
    const options = await apiFetch('/auth/webauthn/register/options', {
      method: 'POST',
      token,
    });
    const attestation = await startRegistration({
      optionsJSON: options as Parameters<typeof startRegistration>[0]['optionsJSON'],
    });
    await apiFetch('/auth/webauthn/register/verify', {
      method: 'POST',
      token,
      body: JSON.stringify({ response: attestation, name }),
    });
    if (portal) {
      const remembered = getRememberedLoginEmail();
      if (remembered) setPasskeyHint(portal, remembered);
    }
  });
}

export type PasskeyCredentialRow = {
  id: string;
  name: string | null;
  device_type: string | null;
  backed_up: boolean | null;
  created_at: string;
  last_used_at: string | null;
};

export async function listPasskeys(token: string): Promise<PasskeyCredentialRow[]> {
  return apiFetch('/auth/webauthn/credentials', { token });
}

export async function deletePasskey(token: string, id: string): Promise<void> {
  await apiFetch(`/auth/webauthn/credentials/${id}/delete`, { method: 'POST', token });
}

export async function renamePasskey(token: string, id: string, name: string): Promise<void> {
  await apiFetch(`/auth/webauthn/credentials/${id}/rename`, {
    method: 'POST',
    token,
    body: JSON.stringify({ name: name.trim() }),
  });
}

export async function updatePasskeyLoginEnabled(token: string, enabled: boolean): Promise<void> {
  await apiFetch('/me', {
    method: 'PATCH',
    token,
    body: JSON.stringify({ passkey_login_enabled: enabled }),
  });
}
