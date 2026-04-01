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

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(AUTH_COOKIE_NAME, token, {
    ...sessionCookieOpts(),
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE_NAME, sessionCookieOpts());
}
