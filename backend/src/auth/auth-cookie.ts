import type { Response } from 'express';
import { env } from '../config/env';

/** HttpOnly oturum çerezi (Bearer ile aynı değer; XSS riskini azaltır). */
export const AUTH_COOKIE_NAME = 'ogp_session';

export function setSessionCookie(res: Response, token: string): void {
  const secure = env.nodeEnv === 'production';
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearSessionCookie(res: Response): void {
  const secure = env.nodeEnv === 'production';
  res.clearCookie(AUTH_COOKIE_NAME, {
    path: '/',
    sameSite: secure ? 'none' : 'lax',
    secure,
  });
}
