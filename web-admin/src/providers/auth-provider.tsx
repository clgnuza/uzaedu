'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { COOKIE_SESSION_TOKEN } from '@/lib/auth-session';
import { safeStorageGetItem, safeStorageRemoveItem, safeStorageSetItem } from '@/lib/safe-storage';
import type { WebAdminRole } from '@/config/types';

const TOKEN_KEY = 'ogretmenpro_token';

/** Evrak formu varsayılan değerleri (profil ayarlarından) */
export type EvrakDefaults = {
  okul_adi?: string;
  mudur_adi?: string;
  ogretim_yili?: string;
  sinif?: string;
  zumreler?: string;
  zumre_ogretmenleri?: string;
  onay_tarihi?: string;
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
    enabled_modules?: string[] | null;
  } | null;
  status?: string;
  /** Moderator için yetkili modüller (sadece role=moderator ise anlamlı). */
  moderator_modules?: string[] | null;
  /** Evrak formunda varsayılan değerler (profil ayarlarından) */
  evrak_defaults?: EvrakDefaults;
  teacher_school_membership?: 'none' | 'pending' | 'approved' | 'rejected';
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
  setToken: (value: string | null) => void;
  logout: () => void;
  refetchMe: () => Promise<Me | null>;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [token, setTokenState] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMe = useCallback(async (t: string | null, noCache = false) => {
    const data = await apiFetch<Me>(
      noCache ? `/me?_=${Date.now()}` : '/me',
      { token: t ?? undefined, ...(noCache && { cache: 'no-store' }) }
    );
    setMe(data);
    setError(null);
    return data;
  }, []);

  useEffect(() => {
    const t = getStoredToken();
    setTokenState(t);
    if (t) {
      fetchMe(t)
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'Hata');
          setMe(null);
        })
        .finally(() => setLoading(false));
      return;
    }
    fetchMe(null)
      .then(() => {
        setTokenState(COOKIE_SESSION_TOKEN);
      })
      .catch(() => {
        setMe(null);
      })
      .finally(() => setLoading(false));
  }, [fetchMe]);

  const setToken = useCallback(
    (value: string | null) => {
      if (typeof window === 'undefined') return;
      if (value === null) {
        safeStorageRemoveItem(TOKEN_KEY);
        setTokenState(null);
        setMe(null);
        void apiFetch('/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
        return;
      }
      safeStorageRemoveItem(TOKEN_KEY);
      setTokenState(null);
      setLoading(true);
      fetchMe(null)
        .then(() => {
          setTokenState(COOKIE_SESSION_TOKEN);
        })
        .catch(() => {
          setMe(null);
        })
        .finally(() => {
          setLoading(false);
        });
    },
    [fetchMe],
  );

  const logout = useCallback(() => {
    setToken(null);
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
