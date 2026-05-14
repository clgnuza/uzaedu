'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import Link from 'next/link';
import { Toolbar, ToolbarHeading, ToolbarPageTitle } from '@/components/layout/toolbar';
import { ToolbarIconHints } from '@/components/layout/toolbar-icon-hints';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ForbiddenView } from '@/components/errors/forbidden-view';
import { Puzzle, ChevronRight, Search, School, Layers } from 'lucide-react';
import { TURKEY_CITIES, getDistrictsForCity } from '@/lib/turkey-addresses';
import {
  SCHOOL_MODULE_KEYS as MODULE_KEYS,
  SCHOOL_MODULE_LABELS as MODULE_LABELS,
  type SchoolModuleKey,
} from '@/config/school-modules';

type SchoolItem = {
  id: string;
  name: string;
  city: string | null;
  district: string | null;
  enabled_modules: string[] | null;
};

type ListResponse = { total: number; page: number; limit: number; items: SchoolItem[] };

function isModuleEnabled(school: SchoolItem, moduleKey: SchoolModuleKey): boolean {
  const em = school.enabled_modules;
  return em === null || em === undefined || em.length === 0 || em.includes(moduleKey);
}

function toggleModule(
  current: string[] | null,
  moduleKey: SchoolModuleKey,
  enable: boolean
): string[] | null {
  if (enable) {
    if (current === null || current === undefined) return null;
    if (current.includes(moduleKey)) return current;
    return [...current, moduleKey];
  }
  if (current === null || current === undefined) {
    return MODULE_KEYS.filter((k) => k !== moduleKey);
  }
  return current.filter((k) => k !== moduleKey);
}

function buildSchoolsQuery(params: { page: number; limit: number; city?: string; district?: string; search?: string }) {
  const u = new URLSearchParams();
  u.set('page', String(params.page));
  u.set('limit', String(params.limit));
  if (params.city?.trim()) u.set('city', params.city.trim());
  if (params.district?.trim()) u.set('district', params.district.trim());
  if (params.search?.trim()) u.set('search', params.search.trim());
  return u.toString();
}

export default function ModulesPage() {
  const { token, me } = useAuth();
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<Record<string, boolean>>({});
  const [filters, setFilters] = useState({ city: '', district: '', search: '' });
  const [bulkModule, setBulkModule] = useState<SchoolModuleKey | ''>('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const limit = 500;
  const isSuperadmin = me?.role === 'superadmin';
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const [hScroll, setHScroll] = useState({ sw: 0, cw: 0 });

  const refreshHorizontalScroll = useCallback(() => {
    const el = mainScrollRef.current;
    if (!el) {
      setHScroll({ sw: 0, cw: 0 });
      return;
    }
    setHScroll({ sw: el.scrollWidth, cw: el.clientWidth });
  }, []);

  useLayoutEffect(() => {
    refreshHorizontalScroll();
  }, [data?.items, loading, refreshHorizontalScroll]);

  useLayoutEffect(() => {
    const el = mainScrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => refreshHorizontalScroll());
    ro.observe(el);
    return () => ro.disconnect();
  }, [refreshHorizontalScroll, data]);

  const fetchSchools = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const q = buildSchoolsQuery({ page: 1, limit, ...filters });
      const res = await apiFetch<ListResponse>(`/schools?${q}`, { token });
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Okul listesi yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [token, filters.city, filters.district, filters.search]);

  useEffect(() => {
    fetchSchools();
  }, [fetchSchools]);

  const handleToggleModule = async (
    school: SchoolItem,
    moduleKey: SchoolModuleKey
  ) => {
    if (!token || !isSuperadmin) return;
    const key = `${school.id}_${moduleKey}`;
    const nextEnabled = !isModuleEnabled(school, moduleKey);
    setToggling((prev) => ({ ...prev, [key]: true }));
    try {
      const nextModules = toggleModule(school.enabled_modules, moduleKey, nextEnabled);
      await apiFetch(`/schools/${school.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ enabled_modules: nextModules }),
      });
      const label = MODULE_LABELS[moduleKey];
      toast.success(nextEnabled ? `${label} açıldı` : `${label} kapatıldı`);
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((s) =>
            s.id === school.id ? { ...s, enabled_modules: nextModules } : s,
          ),
        };
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Güncellenemedi');
    } finally {
      setToggling((prev) => ({ ...prev, [key]: false }));
    }
  };

  const runBulkModule = async (enable: boolean) => {
    if (!token || !bulkModule) {
      toast.error('Önce bir modül seçin.');
      return;
    }
    const label = MODULE_LABELS[bulkModule];
    const ok = window.confirm(
      enable
        ? `Tüm okullarda «${label}» modülünü açmak istiyor musunuz? (Veritabanındaki her okul güncellenir.)`
        : `Tüm okullardan «${label}» modülünü kapatmak istiyor musunuz? İlgili menüler bu okullarda gizlenir.`,
    );
    if (!ok) return;
    setBulkBusy(true);
    try {
      const res = await apiFetch<{ updated: number; total: number }>('/schools/bulk-enabled-modules', {
        method: 'PATCH',
        token,
        body: JSON.stringify({ module_key: bulkModule, enable }),
      });
      toast.success(
        `${res.updated} okul güncellendi${res.total !== undefined ? ` (toplam ${res.total} okul)` : ''}.`,
      );
      fetchSchools();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Toplu güncelleme başarısız');
    } finally {
      setBulkBusy(false);
    }
  };

  if (!isSuperadmin) {
    return <ForbiddenView description="Sadece superadmin modül ayarlarini yonetebilir." />;
  }

  return (
    <div className="space-y-3 text-xs">
      <Toolbar className="pb-2 sm:pb-3">
        <ToolbarHeading>
          <ToolbarPageTitle className="text-base sm:text-lg">Modüller</ToolbarPageTitle>
          <ToolbarIconHints
            items={[
              { label: 'Modül anahtarları', icon: Puzzle },
              { label: 'Okul bazlı', icon: School },
            ]}
            summary="Okul bazlı modül aç/kapa (superadmin). Okul detayında tüm modülleri düzenlemek için Okullar sayfasını kullanın."
          />
        </ToolbarHeading>
      </Toolbar>

      <Card className="border-primary/15">
        <CardHeader className="space-y-1 py-3">
          <CardTitle className="flex items-center gap-1.5 text-sm font-semibold">
            <Layers className="size-4 text-primary" />
            Tüm okullarda modül
          </CardTitle>
          <p className="text-[11px] leading-snug text-muted-foreground">
            Bir modül seçip tüm okullara toplu ekleyin veya tüm okullardan kaldırın. Tek tek tablo ile aynı kurallar
            geçerlidir (açık liste / kapalı beyaz liste).
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 py-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[180px] flex-1">
            <label className="block text-[10px] font-medium text-muted-foreground">Modül</label>
            <select
              value={bulkModule}
              onChange={(e) => setBulkModule((e.target.value || '') as SchoolModuleKey | '')}
              className="mt-0.5 w-full rounded border border-input bg-background px-2 py-1 text-xs"
            >
              <option value="">Seçin…</option>
              {MODULE_KEYS.map((key) => (
                <option key={key} value={key}>
                  {MODULE_LABELS[key]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled={bulkBusy || !bulkModule}
              onClick={() => void runBulkModule(true)}
              className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {bulkBusy ? 'İşleniyor…' : 'Tüm okullara ekle'}
            </button>
            <button
              type="button"
              disabled={bulkBusy || !bulkModule}
              onClick={() => void runBulkModule(false)}
              className="rounded-md border border-destructive/40 bg-destructive/5 px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {bulkBusy ? 'İşleniyor…' : 'Tüm okullardan kaldır'}
            </button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 py-3">
          <CardTitle className="flex items-center gap-1.5 text-sm font-semibold">
            <Puzzle className="size-4" />
            Okul bazlı modüller
          </CardTitle>
          <Link
            href="/schools"
            className="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline"
          >
            Okul detayında düzenle
            <ChevronRight className="size-3.5" />
          </Link>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="mb-2 text-[11px] leading-snug text-muted-foreground">
            Her okul için modülleri açıp kapatabilirsiniz. Kapalı modüllerde ilgili menü ve özellikler
            görünmez.
          </p>
          <form
            onSubmit={(e) => { e.preventDefault(); fetchSchools(); }}
            className="mb-2 flex flex-wrap items-end gap-2"
          >
            <div>
              <label className="block text-xs font-medium text-muted-foreground">İl</label>
              <select
                value={filters.city}
                onChange={(e) => setFilters((f) => ({ ...f, city: e.target.value, district: '' }))}
                className="mt-0.5 w-28 rounded border border-input bg-background px-1.5 py-1 text-xs"
              >
                <option value="">Tümü</option>
                {TURKEY_CITIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground">İlçe</label>
              <select
                value={filters.district}
                onChange={(e) => setFilters((f) => ({ ...f, district: e.target.value }))}
                className="mt-0.5 w-28 rounded border border-input bg-background px-1.5 py-1 text-xs"
              >
                <option value="">Tümü</option>
                {getDistrictsForCity(filters.city, []).map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground">Arama</label>
              <div className="mt-0.5 flex rounded border border-input bg-background">
                <Search className="size-3.5 self-center ml-1.5 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                  placeholder="Okul adı"
                  className="w-32 border-0 bg-transparent px-1.5 py-1 text-xs focus:outline-none focus:ring-0"
                />
              </div>
            </div>
            <button
              type="submit"
              className="rounded-md border border-border bg-muted/50 px-2 py-1 text-xs font-medium hover:bg-muted"
            >
              Filtrele
            </button>
          </form>
          {error && <Alert message={error} className="mb-2" />}
          {loading ? (
            <LoadingSpinner label="Okullar yükleniyor…" className="py-6 text-xs" />
          ) : data && data.items.length > 0 ? (
            <div className="overflow-hidden rounded-md border border-border text-xs">
              {hScroll.sw > hScroll.cw ? (
                <div
                  ref={topScrollRef}
                  className="table-x-scroll max-w-full overflow-x-auto overflow-y-hidden border-b border-border bg-muted/40"
                  onScroll={() => {
                    const m = mainScrollRef.current;
                    const t = topScrollRef.current;
                    if (!m || !t || m.scrollLeft === t.scrollLeft) return;
                    m.scrollLeft = t.scrollLeft;
                  }}
                >
                  <div className="h-2.5 shrink-0" style={{ width: hScroll.sw }} aria-hidden />
                </div>
              ) : null}
              <div
                ref={mainScrollRef}
                className="table-x-scroll max-h-[min(70vh,calc(100dvh-14rem))] max-w-full overflow-auto"
                onScroll={() => {
                  const m = mainScrollRef.current;
                  const t = topScrollRef.current;
                  if (!m || !t || t.scrollLeft === m.scrollLeft) return;
                  t.scrollLeft = m.scrollLeft;
                }}
              >
              <table className="w-full min-w-max border-collapse text-left">
                <thead className="sticky top-0 z-20">
                  <tr className="border-b border-border bg-muted/95 backdrop-blur-sm">
                    <th className="sticky left-0 z-30 min-w-[9rem] max-w-[min(14rem,28vw)] bg-muted/95 px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur-sm">
                      Okul adı
                    </th>
                    <th className="hidden min-w-[5.5rem] max-w-[6.5rem] bg-muted/95 px-1.5 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur-sm md:table-cell">
                      İl / İlçe
                    </th>
                    {MODULE_KEYS.map((key) => (
                      <th
                        key={key}
                        className="w-[2.65rem] min-w-[2.65rem] max-w-[2.65rem] bg-muted/95 px-0.5 py-1 text-center align-bottom text-[10px] font-semibold leading-[1.15] text-muted-foreground backdrop-blur-sm"
                        title={MODULE_LABELS[key]}
                      >
                        <span className="inline-block max-w-[2.55rem] hyphens-auto wrap-anywhere">
                          {MODULE_LABELS[key]}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.items.map((s) => (
                    <tr key={s.id} className="group hover:bg-muted/30">
                      <td className="sticky left-0 z-10 min-w-[9rem] max-w-[min(14rem,28vw)] bg-background px-2 py-1 group-hover:bg-muted/30">
                        <Link
                          href={`/schools/${s.id}`}
                          className="line-clamp-2 font-medium leading-snug text-foreground hover:underline"
                        >
                          {s.name}
                        </Link>
                      </td>
                      <td className="hidden max-w-[6.5rem] px-1.5 py-1 text-[11px] leading-snug text-muted-foreground md:table-cell">
                        <span className="line-clamp-3">{[s.city, s.district].filter(Boolean).join(' / ') || '—'}</span>
                      </td>
                      {MODULE_KEYS.map((moduleKey) => {
                        const enabled = isModuleEnabled(s, moduleKey);
                        const busy = toggling[`${s.id}_${moduleKey}`];
                        return (
                          <td key={moduleKey} className="w-[2.65rem] px-0.5 py-1 text-center">
                            <label
                              className="inline-flex cursor-pointer items-center justify-center"
                              title={`${MODULE_LABELS[moduleKey]}: ${enabled ? 'Açık' : 'Kapalı'}`}
                            >
                              <input
                                type="checkbox"
                                checked={enabled}
                                disabled={busy}
                                onChange={() => handleToggleModule(s, moduleKey)}
                                className="size-3.5 rounded border-input"
                              />
                              {busy && (
                                <span className="ms-0.5 text-[10px] text-muted-foreground">…</span>
                              )}
                            </label>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          ) : (
            <p className="py-6 text-center text-muted-foreground">Henüz okul bulunmuyor.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
