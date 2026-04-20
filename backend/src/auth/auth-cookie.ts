import type { Response } from 'express';
import { env } from '../config/env';

/** HttpOnly oturum çerezi (Bearer ile aynı değer; XSS riskini azaltır). */
export const AUTH_COOKIE_NAME = 'ogp_session';

function cookieSecure(): boolean {
  return (
    process.env.NODE_ENV === 'production' || env.nodeEnv === 'production'
  );
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

/** Tarayıcı kapalıyken bile uzun oturum (Beni hatırla). */
export const SESSION_COOKIE_MAX_AGE_LONG_MS = 7 * 24 * 60 * 60 * 1000;
/** Kısa oturum — paylaşımlı cihaz / sunucu yükü için varsayılan. */
export const SESSION_COOKIE_MAX_AGE_SHORT_MS = 12 * 60 * 60 * 1000;

export function setSessionCookie(res: Response, token: string, opts?: { remember?: boolean }): void {
  const maxAge = opts?.remember ? SESSION_COOKIE_MAX_AGE_LONG_MS : SESSION_COOKIE_MAX_AGE_SHORT_MS;
  res.cookie(AUTH_COOKIE_NAME, token, {
    ...sessionCookieOpts(),
    maxAge,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE_NAME, sessionCookieOpts());
}
