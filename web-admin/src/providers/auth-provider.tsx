'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { apiFetch, type ApiError } from '@/lib/api';
import { COOKIE_SESSION_TOKEN } from '@/lib/auth-session';
import { rememberReturnPath } from '@/lib/post-login-redirect';
import { safeStorageRemoveItem } from '@/lib/safe-storage';
import { clearSessionBearer, getSessionBearer, setSessionBearer } from '@/lib/session-bearer';
import type { WebAdminRole } from '@/config/types';

/** Etkileşim yoksa oturumu kapatır; arka planda /me isteği birikmez. */
const IDLE_LOGOUT_MS = 30 * 60 * 1000;
const IDLE_LOGOUT_ROLES = new Set<WebAdminRole>(['teacher', 'school_admin']);

const TOKEN_KEY = 'ogretmenpro_token';
const meRequestCache = new Map<string, Promise<Me | null>>();
const ME_CACHE_KEY = `cache:${COOKIE_SESSION_TOKEN}`;
const PUBLIC_AUTH_PATHS = new Set([
  '/login',
  '/login/okul',
  '/login/ogretmen',
  '/register',
  '/register/ogretmen',
  '/register/okul',
  '/register-okul',
  '/forgot-password',
  '/forgot-password/ogretmen',
  '/forgot-password/okul',
  '/reset-password',
  '/verify-school-email',
]);

/** Evrak formu varsayılan değerleri (profil ayarlarından) */
export type EvrakDefaults = {
  okul_adi?: string;
  mudur_adi?: string;
  ogretim_yili?: string;
  sinif?: string;
  zumreler?: string;
  zumre_ogretmenleri?: string;
  onay_tarihi?: string;
  ogretmen_unvani?: string;
  yolluk_teacher?: {
    tc_kimlik?: string;
    iban?: string;
    kadro_derecesi?: number;
    kadro_kademesi?: string;
    pdf_unvan?: string;
  };
} | null;

export type Me = {
  id: string;
  email: string;
  display_name: string | null;
  /** Hazır SVG profil anahtarı (sunucu). */
  avatar_key?: string | null;
  /** Harici profil fotoğrafı URL (yönetimden atanabilir). */
  avatar_url?: string | null;
  role: string;
  school_id: string | null;
  teacher_assignment_active?: boolean;
  teacher_assignment_school_id?: string | null;
  teacher_assignment_school?: {
    id: string;
    name: string;
    city?: string | null;
    district?: string | null;
    type?: string;
    status?: string;
  } | null;
  teacher_branch?: string | null;
  school: {
    id: string;
    name: string;
    principalName?: string | null;
    type?: string;
    segment?: string | null;
    city?: string | null;
    district?: string | null;
    status?: string;
    teacher_limit?: number;
    teacher_name_merge_mode?: 'none' | 'automatic' | 'manual';
    enabled_modules?: string[] | null;
  } | null;
  status?: string;
  /** Moderator için yetkili modüller (sadece role=moderator ise anlamlı). */
  moderator_modules?: string[] | null;
  /** Evrak formunda varsayılan değerler (profil ayarlarından) */
  evrak_defaults?: EvrakDefaults;
  teacher_school_membership?: 'none' | 'pending' | 'approved' | 'rejected';
  school_join_stage?: 'none' | 'email_pending' | 'school_pending' | 'approved' | 'rejected';
  school_join_email_verified_at?: string | null;
  email_verified?: boolean;
  /** E-posta+şifre girişinde OTP (varsayılan true) */
  login_otp_required?: boolean;
  passkey_login_enabled?: boolean;
  /** Nöbet günü gelen kutusu hatırlatması (TSİ) */
  duty_reminder_enabled?: boolean;
  duty_reminder_time_tr?: string;
  school_verified?: boolean;
  teacher_public_name_masked?: boolean;
  school_reviews_strike_count?: number;
  school_reviews_site_ban_until?: string | null;
  created_at?: string;
  /** Sunucudan gelirse profil / PATCH sonrası güncelleme zamanı */
  updated_at?: string;
};

type AuthContextValue = {
  token: string | null;
  me: Me | null;
  role: WebAdminRole | null;
  schoolId: string | null;
  loading: boolean;
  error: string | null;
  setToken: (value: string | null) => Promise<boolean>;
  logout: (opts?: { redirectTo?: string }) => void;
  refetchMe: () => Promise<Me | null>;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const prevPathnameRef = useRef<string | undefined>(undefined);
  const meFetchGenRef = useRef(0);
  const meRef = useRef<Me | null>(null);
  const tokenRef = useRef<string | null>(null);
  const cancelStaleMeFetches = useCallback(() => {
    meFetchGenRef.current += 1;
  }, []);
  const invalidateMeCache = useCallback(() => {
    meRequestCache.delete(ME_CACHE_KEY);
    cancelStaleMeFetches();
  }, [cancelStaleMeFetches]);
  const [token, setTokenState] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  meRef.current = me;
  tokenRef.current = token;

  const fetchMe = useCallback(async (initialToken: string | null, noCache = false): Promise<Me | null> => {
    const gen = ++meFetchGenRef.current;
    const isStale = () => gen !== meFetchGenRef.current;
    const staleResult = () => meRef.current;

    let token: string | null = initialToken;
    let retried401 = false;

    const runOnce = async (): Promise<Me | null> => {
      const requestKey = noCache ? `nocache:${token ?? 'cookie'}:${Date.now()}` : `cache:${token ?? 'cookie'}`;
      const existing = meRequestCache.get(requestKey);
      const request = existing ?? apiFetch<Me | null>(
        noCache ? `/me?_=${Date.now()}` : '/me',
        { token: token ?? undefined, ...(noCache && { cache: 'no-store' }) }
      );
      if (!existing) {
        meRequestCache.set(requestKey, request);
        void request.then(
          () => {
            if (noCache) meRequestCache.delete(requestKey);
          },
          () => {
            meRequestCache.delete(requestKey);
          },
        );
      }
      try {
        const data = await request;
        if (isStale()) return staleResult();
        setMe(data ?? null);
        setError(null);
        return data ?? null;
      } catch (e) {
        if (isStale()) return staleResult();
        const ae = e as ApiError;
        if (ae.status === 401 && token && !retried401) {
          safeStorageRemoveItem(TOKEN_KEY);
          clearSessionBearer();
          setTokenState(null);
          token = null;
          retried401 = true;
          setTokenState(COOKIE_SESSION_TOKEN);
          return runOnce();
        }
        if (ae.status === 401) {
          setMe(null);
          setError(null);
          return null;
        }
        setError(e instanceof Error ? e.message : 'Hata');
        setMe(null);
        throw e;
      }
    };

    return runOnce();
  }, []);

  useEffect(() => {
    const isPublicAuth = !!pathname && PUBLIC_AUTH_PATHS.has(pathname);
    if (isPublicAuth) setError(null);
    const fromPublicAuth =
      prevPathnameRef.current !== undefined && PUBLIC_AUTH_PATHS.has(prevPathnameRef.current);
    prevPathnameRef.current = pathname ?? undefined;
    const hadSession =
      !!getSessionBearer() || tokenRef.current === COOKIE_SESSION_TOKEN || !!meRef.current;
    if (fromPublicAuth || isPublicAuth || !hadSession) setLoading(true);
    /** Eski sürüm localStorage Bearer süresiz oturum açıyordu. */
    safeStorageRemoveItem(TOKEN_KEY);
    if (!hadSession) setTokenState(null);
    const finish = () => setLoading(false);
    void fetchMe(COOKIE_SESSION_TOKEN, fromPublicAuth)
      .then((data) => {
        if (data) setTokenState(COOKIE_SESSION_TOKEN);
        else if (!getSessionBearer()) setTokenState(null);
      })
      .catch(() => {
        /* setMe fetchMe içinde; eski istek catch ile oturumu silmesin */
      })
      .finally(finish);
  }, [fetchMe, pathname]);

  const setToken = useCallback(
    async (value: string | null): Promise<boolean> => {
      if (typeof window === 'undefined') return false;
      if (value === null) {
        invalidateMeCache();
        safeStorageRemoveItem(TOKEN_KEY);
        clearSessionBearer();
        setTokenState(null);
        setMe(null);
        setError(null);
        void apiFetch('/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
        return true;
      }
      safeStorageRemoveItem(TOKEN_KEY);
      if (value !== COOKIE_SESSION_TOKEN) setSessionBearer(value);
      setTokenState(COOKIE_SESSION_TOKEN);
      setLoading(true);
      try {
        invalidateMeCache();
        const data = await fetchMe(COOKIE_SESSION_TOKEN, true);
        if (!data) {
          setError('Oturum doğrulanamadı.');
          setMe(null);
          return false;
        }
        setError(null);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Hata');
        setMe(null);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [fetchMe, invalidateMeCache],
  );

  const logout = useCallback((opts?: { redirectTo?: string }) => {
    void setToken(null);
    const to = opts?.redirectTo ?? '/';
    /** Tam sayfa geçiş: RouteGuard admin path'te `!role` iken `/login`'e atıp `replace('/')` ile yarışmasın. */
    if (typeof window !== 'undefined') window.location.assign(to);
    else router.replace(to);
  }, [setToken, router]);

  useEffect(() => {
    if (!me || !pathname || PUBLIC_AUTH_PATHS.has(pathname)) return;
    if (typeof window === 'undefined') return;
    rememberReturnPath(window.location.pathname + window.location.search);
  }, [me, pathname]);

  useEffect(() => {
    if (!me || !IDLE_LOGOUT_ROLES.has(me.role as WebAdminRole)) return;
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        void setToken(null);
        router.replace('/login?reason=idle');
      }, IDLE_LOGOUT_MS);
    };
    const bump = () => arm();
    const onVis = () => {
      if (document.visibilityState === 'visible') bump();
    };
    const opts: AddEventListenerOptions = { passive: true };
    window.addEventListener('mousedown', bump, opts);
    window.addEventListener('keydown', bump, opts);
    window.addEventListener('scroll', bump, opts);
    window.addEventListener('touchstart', bump, opts);
    document.addEventListener('visibilitychange', onVis);
    arm();
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousedown', bump);
      window.removeEventListener('keydown', bump);
      window.removeEventListener('scroll', bump);
      window.removeEventListener('touchstart', bump);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [me, setToken, router]);

  const refetchMe = useCallback(async (): Promise<Me | null> => {
    try {
      const data = await fetchMe(COOKIE_SESSION_TOKEN, true);
      if (data) setTokenState(COOKIE_SESSION_TOKEN);
      else setTokenState(null);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hata');
      setMe(null);
      return null;
    }
  }, [fetchMe]);

  const role: WebAdminRole | null =
    me?.role === 'superadmin' ||
    me?.role === 'school_admin' ||
    me?.role === 'teacher' ||
    me?.role === 'moderator'
      ? me.role
      : null;
  const schoolId = me?.school_id ?? null;

  const value: AuthContextValue = {
    token,
    me,
    role,
    schoolId,
    loading,
    error,
    setToken,
    logout,
    refetchMe,
    isAuthenticated: !!me,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

/** İstemci kabuğu — SSG sırasında bağlam yoksa null */
export function useAuthOptional(): AuthContextValue | null {
  return useContext(AuthContext);
}
