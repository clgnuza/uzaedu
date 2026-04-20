import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { WebExtrasPublic } from '@/lib/web-extras-public';

function resolveMiddlewareApiBase(host: string | undefined): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (fromEnv) return fromEnv;
  const h = (host ?? '').split(':')[0].toLowerCase();
  if (h === 'uzaedu.com' || h === 'www.uzaedu.com') return 'https://api.uzaedu.com/api';
  return 'http://127.0.0.1:4000/api';
}

/** Edge’de her istekte API çağrısını azaltır; TTL kısa tutuldu. */
const MW_CACHE_MS = 12_000;
/** Backend kapalıyken fetch’in middleware’i kilitlememesi (localhost “açılmıyor”). */
const WEB_EXTRAS_FETCH_MS = 2500;
let mwCache: { at: number; data: WebExtrasPublic | null } | null = null;

async function getWebExtras(apiBase: string): Promise<WebExtrasPublic | null> {
  const now = Date.now();
  if (mwCache && now - mwCache.at < MW_CACHE_MS) return mwCache.data;
  const signal =
    typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
      ? AbortSignal.timeout(WEB_EXTRAS_FETCH_MS)
      : undefined;
  try {
    const res = await fetch(`${apiBase.replace(/\/$/, '')}/content/web-extras`, {
      cache: 'no-store',
      signal,
    });
    const data = res.ok ? ((await res.json()) as WebExtrasPublic) : null;
    mwCache = { at: now, data };
    return data;
  } catch {
    mwCache = { at: now, data: mwCache?.data ?? null };
    return mwCache.data;
  }
}

function isAllowedPath(pathname: string, extras: WebExtrasPublic): boolean {
  const exact = extras.maintenance_allowed_exact ?? [];
  if (exact.includes(pathname)) return true;
  const prefixes = extras.maintenance_allowed_prefixes ?? [];
  for (const p of prefixes) {
    if (!p) continue;
    if (pathname === p || pathname.startsWith(`${p}/`)) return true;
  }
  return false;
}

export async function middleware(request: NextRequest) {
  const host = request.headers.get('host')?.split(':')[0];
  if (host === 'admin.uzaedu.com') {
    const u = request.nextUrl.clone();
    u.hostname = 'uzaedu.com';
    return NextResponse.redirect(u, 308);
  }
  const extras = await getWebExtras(resolveMiddlewareApiBase(host));
  if (!extras?.maintenance_enabled) return NextResponse.next();
  const pathname = request.nextUrl.pathname;
  if (pathname === '/bakim' || isAllowedPath(pathname, extras)) return NextResponse.next();
  return NextResponse.redirect(new URL('/bakim', request.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)'],
};
