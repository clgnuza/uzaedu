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
import { safeStorageGetItem, safeStorageRemoveItem, safeStorageSetItem } from '@/lib/safe-storage';
import type { WebAdminRole } from '@/config/types';

const TOKEN_KEY = 'ogretmenpro_token';
const meRequestCache = new Map<string, Promise<Me | null>>();
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
  school_verified?: boolean;
  teacher_public_name_masked?: boolean;
  created_at?: string;
  /** Sunucudan gelirse profil / PATCH sonrası güncelleme zamanı */
  updated_at?: string;
};

function getStoredToken(): string | null {
  return safeStorageGetItem(TOKEN_KEY);
}

type AuthContextValue = {
  token: string | null;
  me: Me | null;
  role: WebAdminRole | null;
  schoolId: string | null;
  loading: boolean;
  error: string | null;
  setToken: (value: string | null) => Promise<void>;
  logout: () => void;
  refetchMe: () => Promise<Me | null>;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const prevPathnameRef = useRef<string | undefined>(undefined);
  const [token, setTokenState] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMe = useCallback(async (initialToken: string | null, noCache = false): Promise<Me | null> => {
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
        setMe(data ?? null);
        setError(null);
        return data ?? null;
      } catch (e) {
        const ae = e as ApiError;
        if (ae.status === 401 && token && !retried401) {
          safeStorageRemoveItem(TOKEN_KEY);
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
    if (pathname && PUBLIC_AUTH_PATHS.has(pathname)) {
      setError(null);
      setLoading(false);
      prevPathnameRef.current = pathname;
      return;
    }
    const fromPublicAuth =
      prevPathnameRef.current !== undefined && PUBLIC_AUTH_PATHS.has(prevPathnameRef.current);
    prevPathnameRef.current = pathname ?? undefined;
    if (fromPublicAuth) setLoading(true);
    const t = getStoredToken();
    setTokenState(t);
    if (t) {
      void fetchMe(t)
        .then((data) => {
          if (data === null) {
            setMe(null);
            setTokenState(null);
          }
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'Hata');
          setMe(null);
        })
        .finally(() => setLoading(false));
      return;
    }
    void fetchMe(null)
      .then((data) => {
        if (data) setTokenState(COOKIE_SESSION_TOKEN);
      })
      .catch(() => {
        setMe(null);
      })
      .finally(() => setLoading(false));
  }, [fetchMe, pathname]);

  const setToken = useCallback(
    async (value: string | null): Promise<void> => {
      if (typeof window === 'undefined') return;
      if (value === null) {
        safeStorageRemoveItem(TOKEN_KEY);
        setTokenState(null);
        setMe(null);
        setError(null);
        void apiFetch('/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
        return;
      }
      safeStorageSetItem(TOKEN_KEY, value);
      setTokenState(value);
      setLoading(true);
      try {
        const data = await fetchMe(value);
        if (!data) {
          setError('Oturum doğrulanamadı.');
          setMe(null);
        } else {
          setError(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Hata');
        setMe(null);
      } finally {
        setLoading(false);
      }
    },
    [fetchMe],
  );

  const logout = useCallback(() => {
    void setToken(null);
    router.replace('/');
  }, [setToken, router]);

  const refetchMe = useCallback(async (): Promise<Me | null> => {
    const t = getStoredToken();
    if (t) {
      setTokenState(t);
      try {
        return await fetchMe(t, true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Hata');
        setMe(null);
        return null;
      }
    }
    try {
      const data = await fetchMe(null, true);
      setTokenState(COOKIE_SESSION_TOKEN);
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
