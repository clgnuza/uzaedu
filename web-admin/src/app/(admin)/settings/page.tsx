'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch, getApiUrl } from '@/lib/api';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { TeacherAccountTabs } from './teacher-account-tabs';
import { SchoolAdminAccountTabs } from './school-admin-account-tabs';
import { SuperadminAccountTabs } from './superadmin-account-tabs';
import { Tv, ChevronRight, ChevronDown, Server, Database, Calculator } from 'lucide-react';
import { cn } from '@/lib/utils';

type SchoolTvConfig = {
  id: string;
  name: string;
  tv_weather_city?: string | null;
  tv_welcome_image_url?: string | null;
  tv_default_slide_duration?: number | null;
};

type HealthResponse = { status: string; service: string };

export default function SettingsPage() {
  const { token, me } = useAuth();
  const [schoolConfig, setSchoolConfig] = useState<SchoolTvConfig | null>(null);
  const [backendStatus, setBackendStatus] = useState<'ok' | 'error' | 'checking'>('checking');
  const [tvCollapsed, setTvCollapsed] = useState(true);
  const [generalCollapsed, setGeneralCollapsed] = useState(true);
  const [systemCollapsed, setSystemCollapsed] = useState(true);
  const [extraLessonCollapsed, setExtraLessonCollapsed] = useState(true);
  const schoolId = me?.school_id ?? me?.school?.id;

  useEffect(() => {
    if (!token || !schoolId || me?.role !== 'school_admin') return;
    apiFetch<SchoolTvConfig>(`/schools/${schoolId}`, { token })
      .then(setSchoolConfig)
      .catch(() => setSchoolConfig(null));
  }, [token, schoolId, me?.role]);

  const checkHealth = useCallback(() => {
    setBackendStatus('checking');
    fetch(getApiUrl('/health'), { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Health check failed'))))
      .then((d: HealthResponse) => (d?.status === 'ok' ? setBackendStatus('ok') : setBackendStatus('error')))
      .catch(() => setBackendStatus('error'));
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  const pageTitle =
    me?.role === 'teacher'
      ? 'Hesabım Ayarlar'
      : me?.role === 'school_admin'
        ? 'Okul ve hesap ayarları'
        : me?.role === 'superadmin'
          ? 'Süper yönetici ayarları'
          : 'Ayarlar';
  const pageDesc =
    me?.role === 'teacher'
      ? 'Hesap bilgilerinizi yönetin'
      : me?.role === 'school_admin'
        ? 'Kişisel hesap, veri talepleri ve okul içerik ayarları'
        : me?.role === 'superadmin'
          ? 'Hesap, güvenlik ve platform kısayolları'
          : 'Okul ayarlarınızı yönetin';

  return (
    <div className="space-y-4">
      <h1 className="sr-only">{pageTitle}</h1>
      <p className="max-w-2xl rounded-2xl border border-border/50 bg-muted/20 px-4 py-3 text-sm leading-relaxed text-muted-foreground sm:px-5">
        {pageDesc}
      </p>

      {/* Öğretmen: Sekmeli Hesabım yapısı */}
      {me?.role === 'teacher' && (
        <Suspense fallback={<p className="text-sm text-muted-foreground">Yükleniyor…</p>}>
          <TeacherAccountTabs />
        </Suspense>
      )}

      {me?.role === 'school_admin' && (
        <Suspense fallback={<p className="text-sm text-muted-foreground">Yükleniyor…</p>}>
          <SchoolAdminAccountTabs />
        </Suspense>
      )}

      {me?.role === 'superadmin' && (
        <Suspense fallback={<p className="text-sm text-muted-foreground">Yükleniyor…</p>}>
          <SuperadminAccountTabs />
        </Suspense>
      )}

      {/* Diğer roller: Kart tabanlı ayarlar */}
      {me?.role !== 'teacher' && me?.role !== 'superadmin' && (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* Duyuru TV – school_admin için */}
        {me?.role === 'school_admin' && (
          <Card className="flex flex-col">
            <button
              type="button"
              onClick={() => setTvCollapsed((c) => !c)}
              className="flex min-w-0 flex-1 items-center justify-between gap-2 px-3 py-2.5 text-left"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Tv className="size-4 shrink-0 text-primary" />
                <CardTitle className="truncate text-sm">Duyuru TV</CardTitle>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Link
                  href="/tv"
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Git
                </Link>
                {tvCollapsed ? (
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                ) : (
                  <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
                )}
              </div>
            </button>
            <CardContent className={cn('border-t border-border px-3 py-2 text-xs', tvCollapsed && 'hidden')}>
              <p className="text-muted-foreground">Koridor + Öğretmenler Odası. Hava durumu, görsel, cihaz eşleştirme.</p>
              {schoolConfig && (
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 rounded border border-border bg-muted/30 px-2 py-1.5 text-xs">
                  <span className="text-muted-foreground">Hava:</span>
                  <span>{schoolConfig.tv_weather_city || 'Kapalı'}</span>
                  <span className="text-muted-foreground">Slayt:</span>
                  <span>{schoolConfig.tv_default_slide_duration ?? 10} sn</span>
                  <span className="text-muted-foreground col-span-2">Görsel: {schoolConfig.tv_welcome_image_url ? 'Var' : 'Yok'}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Genel okul ayarları placeholder */}
        {me?.role === 'school_admin' && (
          <Card className="flex flex-col">
            <button
              type="button"
              onClick={() => setGeneralCollapsed((c) => !c)}
              className="flex w-full items-center justify-between px-3 py-2.5 text-left"
            >
              <CardTitle className="text-sm">Genel okul</CardTitle>
              {generalCollapsed ? (
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
              ) : (
                <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
              )}
            </button>
            <CardContent className={cn('border-t border-border space-y-2 px-3 py-2 text-xs', generalCollapsed && 'hidden')}>
              <p className="text-muted-foreground">
                Tanıtım, takvim, TV ve sınıf ayarlarına üstteki <strong className="font-medium text-foreground">Okul</strong> sekmesinden veya doğrudan bağlantılardan gidin.
              </p>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                <Link href="/settings?tab=okul" className="font-medium text-primary hover:underline">
                  Tüm okul bağlantıları
                </Link>
                <Link href="/school-profile" className="text-primary hover:underline">
                  Okul tanıtım
                </Link>
                <Link href="/akademik-takvim-ayarlar" className="text-primary hover:underline">
                  Akademik takvim
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sistem durumu – tüm roller */}
        <Card className="flex flex-col sm:col-span-2 lg:col-span-1">
          <button
            type="button"
            onClick={() => setSystemCollapsed((c) => !c)}
            className="flex w-full items-center justify-between px-3 py-2.5 text-left"
          >
            <div className="flex items-center gap-2">
              <Server className="size-4 shrink-0 text-muted-foreground" />
              <CardTitle className="text-sm">Sistem durumu</CardTitle>
              {backendStatus === 'ok' && (
                <span className="size-1.5 rounded-full bg-green-500" aria-label="Bağlı" title="Bağlı" />
              )}
              {backendStatus === 'error' && (
                <span className="size-1.5 rounded-full bg-destructive" aria-label="Bağlantı yok" title="Bağlantı yok" />
              )}
            </div>
            {systemCollapsed ? (
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
            ) : (
              <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
            )}
          </button>
          <CardContent className={cn('border-t border-border space-y-2 px-3 py-2 text-xs', systemCollapsed && 'hidden')}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground">Backend:</span>
              {backendStatus === 'checking' && <span className="text-muted-foreground">Kontrol ediliyor…</span>}
              {backendStatus === 'ok' && (
                <span className="rounded-full bg-green-500/15 px-2 py-0.5 font-medium text-green-700 dark:text-green-400">Bağlı</span>
              )}
              {backendStatus === 'error' && (
                <>
                  <span className="rounded-full bg-destructive/15 px-2 py-0.5 font-medium text-destructive">Bağlantı yok</span>
                  <button
                    type="button"
                    onClick={checkHealth}
                    className="rounded border border-border bg-muted px-2 py-0.5 text-muted-foreground hover:bg-muted/80"
                  >
                    Yenile
                  </button>
                </>
              )}
            </div>
            {backendStatus === 'error' && (
              <p className="text-muted-foreground">Backend çalışmıyor veya erişilemiyor. Port 4000&apos;i kontrol edin.</p>
            )}
            {me?.role === 'superadmin' && (
              <div className="rounded border border-border bg-muted/30 p-2 space-y-1.5">
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  <Database className="size-3.5" />
                  Docker / PostgreSQL
                </div>
                <code className="block rounded bg-muted px-2 py-1 text-[11px] font-mono">docker compose up -d</code>
                <code className="block text-[11px]">cd backend && npm run start:dev</code>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Hesaplama Parametreleri – superadmin */}
        {me?.role === 'superadmin' && (
          <Card className="flex flex-col sm:col-span-2">
            <button
              type="button"
              onClick={() => setExtraLessonCollapsed((c) => !c)}
              className="flex w-full items-center justify-between px-3 py-2.5 text-left"
            >
              <div className="flex items-center gap-2">
                <Calculator className="size-4 shrink-0 text-primary" />
                <CardTitle className="text-sm">Hesaplama Parametreleri</CardTitle>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Link
                  href="/extra-lesson-params"
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Ayarlara git
                </Link>
                {extraLessonCollapsed ? (
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                ) : (
                  <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
                )}
              </div>
            </button>
            <CardContent className={cn('border-t border-border px-3 py-2 text-xs', extraLessonCollapsed && 'hidden')}>
              <p className="text-muted-foreground">
                Bütçe dönemleri, gösterge tablosu, birim ücretler, vergi dilimleri ve GV/DV istisnaları. Tüm hesaplama parametreleri buradan yönetilir.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
      )}
    </div>
  );
}
