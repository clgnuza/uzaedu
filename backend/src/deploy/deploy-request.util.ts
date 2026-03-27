import type { Request } from 'express';

/** X-Forwarded-For ilk adresi veya doğrudan bağlantı IP’si */
export function getClientIp(req: Request): string {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length) {
    return xf.split(',')[0].trim();
  }
  if (Array.isArray(xf) && xf[0]) {
    return xf[0].trim();
  }
  const sock = req.socket?.remoteAddress;
  if (sock) return sock;
  return typeof req.ip === 'string' ? req.ip : '';
}

/** IPv4 eşlemesi ve ::1 → 127.0.0.1 (karşılaştırma için) */
export function normalizeIpForCompare(ip: string): string {
  let s = ip.trim();
  if (s.startsWith('::ffff:')) s = s.slice(7);
  if (s === '::1') return '127.0.0.1';
  return s;
}

export function isClientIpAllowed(clientIp: string, allowedList: string[]): boolean {
  if (allowedList.length === 0) return true;
  const c = normalizeIpForCompare(clientIp);
  return allowedList.some((a) => normalizeIpForCompare(a) === c);
}
