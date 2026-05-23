import type { Response } from 'express';
import { env } from '../config/env';

/** HttpOnly oturum çerezi (Bearer ile aynı değer; XSS riskini azaltır). */
export const AUTH_COOKIE_NAME = 'ogp_session';

function cookieSecure(): boolean {
  if (process.env.COOKIE_SECURE === 'false' || process.env.COOKIE_SECURE === '0') return false;
  if (process.env.COOKIE_SECURE === 'true' || process.env.COOKIE_SECURE === '1') return true;
  /** Yerelde `FRONTEND_URL=https://...` kopyası Secure çerez zorlar; http://localhost girişi kırılır. */
  const isProd =
    process.env.NODE_ENV === 'production' || env.nodeEnv === 'production';
  return isProd;
}

function sessionCookieOpts(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'none' | 'lax';
  path: string;
  domain?: string;
} {
  const secure = cookieSecure();
  const base = {
    httpOnly: true,
    secure,
    sameSite: (secure ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
  };
  const d = env.sessionCookieDomain?.trim();
  return d ? { ...base, domain: d } : base;
}

/** Beni hatırla: tarayıcı kapansa bile sınırlı süre (maxAge). */
export const SESSION_COOKIE_MAX_AGE_LONG_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * remember=false: maxAge yok → oturum çerezi (tarayıcı oturumu bitince silinir; paylaşımlı PC için).
 * remember=true: 7 gün.
 */
export function setSessionCookie(res: Response, token: string, opts?: { remember?: boolean }): void {
  const base = sessionCookieOpts();
  if (opts?.remember === true) {
    res.cookie(AUTH_COOKIE_NAME, token, { ...base, maxAge: SESSION_COOKIE_MAX_AGE_LONG_MS });
  } else {
    res.cookie(AUTH_COOKIE_NAME, token, base);
  }
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE_NAME, sessionCookieOpts());
}
