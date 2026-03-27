'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import Link from 'next/link';
import { Toolbar, ToolbarHeading, ToolbarPageTitle } from '@/components/layout/toolbar';
import { ToolbarIconHints } from '@/components/layout/toolbar-icon-hints';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
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
    return (
      <div className="space-y-6">
        <Alert message="Bu sayfaya erişim yetkiniz yok. Sadece superadmin modül ayarlarını yönetebilir." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Toolbar>
        <ToolbarHeading>
          <ToolbarPageTitle>Modüller</ToolbarPageTitle>
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="size-5 text-primary" />
            Tüm okullarda modül
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Bir modül seçip tüm okullara toplu ekleyin veya tüm okullardan kaldırın. Tek tek tablo ile aynı kurallar
            geçerlidir (açık liste / kapalı beyaz liste).
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[220px] flex-1">
            <label className="block text-xs font-medium text-muted-foreground">Modül</label>
            <select
              value={bulkModule}
              onChange={(e) => setBulkModule((e.target.value || '') as SchoolModuleKey | '')}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Seçin…</option>
              {MODULE_KEYS.map((key) => (
                <option key={key} value={key}>
                  {MODULE_LABELS[key]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={bulkBusy || !bulkModule}
              onClick={() => void runBulkModule(true)}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {bulkBusy ? 'İşleniyor…' : 'Tüm okullara ekle'}
            </button>
            <button
              type="button"
              disabled={bulkBusy || !bulkModule}
              onClick={() => void runBulkModule(false)}
              className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {bulkBusy ? 'İşleniyor…' : 'Tüm okullardan kaldır'}
            </button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Puzzle className="size-5" />
            Okul bazlı modüller
          </CardTitle>
          <Link
            href="/schools"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Okul detayında düzenle
            <ChevronRight className="size-4" />
          </Link>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Her okul için modülleri açıp kapatabilirsiniz. Kapalı modüllerde ilgili menü ve özellikler
            görünmez.
          </p>
          <form
            onSubmit={(e) => { e.preventDefault(); fetchSchools(); }}
            className="mb-4 flex flex-wrap items-end gap-3"
          >
            <div>
              <label className="block text-xs font-medium text-muted-foreground">İl</label>
              <select
                value={filters.city}
                onChange={(e) => setFilters((f) => ({ ...f, city: e.target.value, district: '' }))}
                className="mt-0.5 w-32 rounded border border-input bg-background px-2.5 py-1.5 text-sm"
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
                className="mt-0.5 w-32 rounded border border-input bg-background px-2.5 py-1.5 text-sm"
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
                <Search className="size-4 self-center ml-2 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                  placeholder="Okul adı"
                  className="w-36 border-0 bg-transparent px-2 py-1.5 text-sm focus:outline-none focus:ring-0"
                />
              </div>
            </div>
            <button
              type="submit"
              className="rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-sm font-medium hover:bg-muted"
            >
              Filtrele
            </button>
          </form>
          {error && <Alert message={error} className="mb-4" />}
          {loading ? (
            <LoadingSpinner label="Okullar yükleniyor…" className="py-8" />
          ) : data && data.items.length > 0 ? (
            <div className="table-x-scroll rounded-lg border border-border">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="sticky left-0 z-10 min-w-[180px] bg-muted/40 px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">
                      Okul adı
                    </th>
                    <th className="hidden min-w-[120px] px-4 py-3 text-xs font-semibold uppercase text-muted-foreground md:table-cell">
                      İl / İlçe
                    </th>
                    {MODULE_KEYS.map((key) => (
                      <th
                        key={key}
                        className="min-w-[72px] px-2 py-3 text-center text-xs font-semibold uppercase text-muted-foreground"
                        title={MODULE_LABELS[key]}
                      >
                        {MODULE_LABELS[key]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.items.map((s) => (
                    <tr key={s.id} className="group hover:bg-muted/30">
                      <td className="sticky left-0 z-10 bg-background px-4 py-3 group-hover:bg-muted/30">
                        <Link
                          href={`/schools/${s.id}`}
                          className="font-medium text-foreground hover:underline"
                        >
                          {s.name}
                        </Link>
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                        {[s.city, s.district].filter(Boolean).join(' / ') || '—'}
                      </td>
                      {MODULE_KEYS.map((moduleKey) => {
                        const enabled = isModuleEnabled(s, moduleKey);
                        const busy = toggling[`${s.id}_${moduleKey}`];
                        return (
                          <td key={moduleKey} className="px-2 py-3 text-center">
                            <label
                              className="inline-flex cursor-pointer items-center justify-center"
                              title={`${MODULE_LABELS[moduleKey]}: ${enabled ? 'Açık' : 'Kapalı'}`}
                            >
                              <input
                                type="checkbox"
                                checked={enabled}
                                disabled={busy}
                                onChange={() => handleToggleModule(s, moduleKey)}
                                className="rounded border-input"
                              />
                              {busy && (
                                <span className="ms-1 text-muted-foreground text-xs">…</span>
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
          ) : (
            <p className="py-6 text-center text-muted-foreground">Henüz okul bulunmuyor.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
