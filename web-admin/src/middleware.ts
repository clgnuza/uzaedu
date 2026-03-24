import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { WebExtrasPublic } from '@/lib/web-extras-public';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api';

/** Edge’de her istekte API çağrısını azaltır; TTL kısa tutuldu. */
const MW_CACHE_MS = 12_000;
let mwCache: { at: number; data: WebExtrasPublic | null } | null = null;

async function getWebExtras(): Promise<WebExtrasPublic | null> {
  const now = Date.now();
  if (mwCache && now - mwCache.at < MW_CACHE_MS) return mwCache.data;
  try {
    const res = await fetch(`${API_BASE.replace(/\/$/, '')}/content/web-extras`, {
      cache: 'no-store',
    });
    const data = res.ok ? ((await res.json()) as WebExtrasPublic) : null;
    mwCache = { at: now, data };
    return data;
  } catch {
    return mwCache?.data ?? null;
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
  const extras = await getWebExtras();
  if (!extras?.maintenance_enabled) return NextResponse.next();
  const pathname = request.nextUrl.pathname;
  if (pathname === '/bakim' || isAllowedPath(pathname, extras)) return NextResponse.next();
  return NextResponse.redirect(new URL('/bakim', request.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)'],
};
