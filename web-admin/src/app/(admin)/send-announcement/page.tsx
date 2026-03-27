'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Filter, Megaphone, Plus, School, Search, Mail, X } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Toolbar, ToolbarHeading, ToolbarPageTitle } from '@/components/layout/toolbar';
import { ToolbarIconHints } from '@/components/layout/toolbar-icon-hints';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { SendAdminMessageForm } from '@/components/send-admin-message-form';
import { AdminMessageListSection } from '@/components/admin-message-list';
import { SentAdminBatchesPanel } from '@/components/sent-admin-batches-panel';
import { TURKEY_CITIES, getDistrictsForCity } from '@/lib/turkey-addresses';
import {
  SCHOOL_TYPE_LABELS,
  formatSchoolTypeLabel,
  SCHOOL_SEGMENT_LABELS,
  SCHOOL_STATUS_LABELS,
  buildSchoolsListQuery,
} from '@/lib/school-labels';
import { cn } from '@/lib/utils';

type SchoolItem = {
  id: string;
  name: string;
  city: string | null;
  district: string | null;
  type: string;
  segment: string;
  status: string;
};

type ListResponse = { total: number; page: number; limit: number; items: SchoolItem[] };

const LIMIT = 500;

const FILTER_SELECT =
  'w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground transition-shadow duration-150 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20';

export default function SendAnnouncementPage() {
  const router = useRouter();
  const { token, me } = useAuth();
  const [schools, setSchools] = useState<SchoolItem[]>([]);
  const [listTotal, setListTotal] = useState(0);
  const [selectedSchoolIds, setSelectedSchoolIds] = useState<string[]>([]);
  const [filters, setFilters] = useState({
    city: '',
    district: '',
    status: '',
    type: '',
    segment: '',
    search: '',
  });
  const [schoolIdForList, setSchoolIdForList] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const isSuperadmin = me?.role === 'superadmin';

  const districtOptions = useMemo(
    () => (filters.city ? getDistrictsForCity(filters.city, []) : []),
    [filters.city],
  );

  const fetchSchools = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const q = buildSchoolsListQuery({ page: 1, limit: LIMIT, ...filters });
      const res = await apiFetch<ListResponse>(`/schools?${q}`, { token });
      setSchools(res.items ?? []);
      setListTotal(res.total ?? 0);
    } catch {
      setSchools([]);
      setListTotal(0);
    } finally {
      setLoading(false);
    }
  }, [token, filters]);

  useEffect(() => {
    if (!isSuperadmin) {
      router.replace('/403');
      return;
    }
    if (token) fetchSchools();
  }, [isSuperadmin, fetchSchools, router, token]);

  useEffect(() => {
    setSelectedSchoolIds((prev) => prev.filter((id) => schools.some((s) => s.id === id)));
  }, [schools]);

  useEffect(() => {
    if (!schools.length) {
      setSchoolIdForList('');
      return;
    }
    setSchoolIdForList((prev) => (schools.some((s) => s.id === prev) ? prev : schools[0].id));
  }, [schools]);

  const toggleSelectAllInView = () => {
    const ids = schools.map((s) => s.id);
    const allSelected = ids.length > 0 && ids.every((id) => selectedSchoolIds.includes(id));
    setSelectedSchoolIds(allSelected ? [] : ids);
  };

  const clearFilters = () => {
    setFilters({ city: '', district: '', status: '', type: '', segment: '', search: '' });
  };

  const hasActiveFilters = Boolean(
    filters.city || filters.district || filters.status || filters.type || filters.segment || filters.search.trim(),
  );

  if (!isSuperadmin) return null;

  return (
    <div className="space-y-8">
      <Toolbar>
        <ToolbarHeading>
          <ToolbarPageTitle className="text-2xl md:text-3xl">Okullara Sistem Mesajı Gönder</ToolbarPageTitle>
          <ToolbarIconHints
            items={[
              { label: 'İl / ilçe / tip', icon: Filter },
              { label: 'Okul seçimi', icon: School },
              { label: 'Sistem mesajı', icon: Megaphone },
              { label: 'Sistem Mesajları', icon: Mail },
            ]}
            summary='Önce filtreyle hedef okulları daraltın, listeden işaretleyin veya «Listelenenlerin tümünü seç» kullanın. Mesajlar yalnızca okul admininin «Sistem Mesajları» sayfasında görünür (Duyuru TV değil).'
          />
        </ToolbarHeading>
      </Toolbar>

      <SentAdminBatchesPanel token={token} refreshTrigger={refreshKey} />

      <Card className="overflow-hidden border-border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <School className="size-5" />
            Okul seçin
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            İl, ilçe, okul tipi, segment ve durum ile listeyi süzün; arama kutusu okul adında arar. Seçimler yalnızca şu an
            listelenen kayıtlar için geçerlidir.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <LoadingSpinner label="Okullar yükleniyor…" className="py-6" />
          ) : schools.length === 0 && !hasActiveFilters ? (
            <EmptyState
              icon={<School />}
              title="Henüz okul yok"
              description="Okullar sayfasından önce okul ekleyin."
            />
          ) : (
            <>
              <div className="rounded-xl border border-border/80 bg-muted/20 p-4 dark:bg-muted/10">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Filter className="size-4 text-muted-foreground" aria-hidden />
                  <span className="text-sm font-medium text-foreground">Filtreler</span>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="ml-auto inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
                    >
                      <X className="size-3.5" />
                      Temizle
                    </button>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                  <label className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">İl</span>
                    <select
                      className={FILTER_SELECT}
                      value={filters.city}
                      onChange={(e) =>
                        setFilters((f) => ({ ...f, city: e.target.value, district: '' }))
                      }
                    >
                      <option value="">Tüm iller</option>
                      {TURKEY_CITIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">İlçe</span>
                    <select
                      className={cn(FILTER_SELECT, !filters.city && 'cursor-not-allowed opacity-70')}
                      value={filters.district}
                      disabled={!filters.city}
                      onChange={(e) => setFilters((f) => ({ ...f, district: e.target.value }))}
                    >
                      <option value="">{filters.city ? 'Tüm ilçeler' : 'Önce il seçin'}</option>
                      {districtOptions.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Okul tipi</span>
                    <select
                      className={FILTER_SELECT}
                      value={filters.type}
                      onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
                    >
                      <option value="">Tümü</option>
                      {Object.entries(SCHOOL_TYPE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Segment</span>
                    <select
                      className={FILTER_SELECT}
                      value={filters.segment}
                      onChange={(e) => setFilters((f) => ({ ...f, segment: e.target.value }))}
                    >
                      <option value="">Tümü</option>
                      {Object.entries(SCHOOL_SEGMENT_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Durum</span>
                    <select
                      className={FILTER_SELECT}
                      value={filters.status}
                      onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
                    >
                      <option value="">Tümü</option>
                      {Object.entries(SCHOOL_STATUS_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1.5 lg:col-span-2 xl:col-span-1">
                    <span className="text-xs font-medium text-muted-foreground">Okul adında ara</span>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        value={filters.search}
                        onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                        placeholder="İsim…"
                        className="w-full rounded-xl border border-input bg-background py-2.5 pl-9 pr-3 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                      />
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{schools.length}</span> okul listeleniyor
                  {listTotal > schools.length && (
                    <span className="text-amber-600 dark:text-amber-400">
                      {' '}
                      (veritabanında toplam {listTotal}; tek sayfada en fazla {LIMIT} gösterilir — daraltmak için filtre kullanın)
                    </span>
                  )}
                  {selectedSchoolIds.length > 0 && (
                    <span className="text-foreground"> — {selectedSchoolIds.length} seçili</span>
                  )}
                </p>
                <button
                  type="button"
                  onClick={toggleSelectAllInView}
                  disabled={schools.length === 0}
                  className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium shadow-sm transition-all duration-150 hover:bg-muted hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {schools.length > 0 && schools.every((s) => selectedSchoolIds.includes(s.id))
                    ? 'Listede hiçbirini seçme'
                    : 'Listelenenlerin tümünü seç'}
                </button>
              </div>

              <div className="max-h-[min(320px,50vh)] overflow-y-auto rounded-xl border border-input p-2 space-y-1">
                {schools.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Filtreye uygun okul yok. Kriterleri gevşetin veya temizleyin.
                  </p>
                ) : (
                  schools.map((s) => (
                    <label
                      key={s.id}
                      className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/50"
                    >
                      <input
                        type="checkbox"
                        checked={selectedSchoolIds.includes(s.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSchoolIds((prev) => [...prev, s.id]);
                          } else {
                            setSelectedSchoolIds((prev) => prev.filter((id) => id !== s.id));
                          }
                        }}
                        className="mt-0.5 size-4 shrink-0 rounded border-input"
                      />
                      <span className="min-w-0 flex-1 text-sm">
                        <span className="font-medium text-foreground">{s.name}</span>
                        {(s.city || s.district) && (
                          <span className="text-muted-foreground">
                            {' '}
                            · {[s.city, s.district].filter(Boolean).join(' / ')}
                          </span>
                        )}
                        <span className="mt-1 flex flex-wrap gap-1.5">
                          <span className="inline-flex rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {formatSchoolTypeLabel(s.type)}
                          </span>
                          <span className="inline-flex rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {SCHOOL_SEGMENT_LABELS[s.segment] ?? s.segment}
                          </span>
                          <span className="inline-flex rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {SCHOOL_STATUS_LABELS[s.status] ?? s.status}
                          </span>
                        </span>
                      </span>
                    </label>
                  ))
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {schools.length > 0 && (
        <Card className="overflow-hidden border-border shadow-sm">
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="size-5" />
              {schools.find((s) => s.id === schoolIdForList)?.name ?? 'Okul'} – Gönderilen mesajlar
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={schoolIdForList}
                onChange={(e) => setSchoolIdForList(e.target.value)}
                className="max-w-[min(100vw-2rem,28rem)] rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground transition-shadow duration-150 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
              >
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {(s.city || s.district) && ` · ${[s.city, s.district].filter(Boolean).join(' / ')}`}
                  </option>
                ))}
              </select>
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-xl border border-primary bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-shadow duration-150 hover:opacity-90 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    disabled={selectedSchoolIds.length === 0}
                    title={
                      selectedSchoolIds.length === 0
                        ? 'Önce okul seçin'
                        : `${selectedSchoolIds.length} okula mesaj gönder`
                    }
                  >
                    <Plus className="size-4" />
                    Yeni mesaj gönder
                    {selectedSchoolIds.length > 0 && ` (${selectedSchoolIds.length} okul)`}
                  </button>
                </DialogTrigger>
                <DialogContent title="Yeni sistem mesajı gönder" className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <SendAdminMessageForm
                    token={token}
                    schoolIds={selectedSchoolIds}
                    onSuccess={() => {
                      setCreateOpen(false);
                      setRefreshKey((k) => k + 1);
                    }}
                    onCancel={() => setCreateOpen(false)}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <AdminMessageListSection token={token} schoolId={schoolIdForList} refreshTrigger={refreshKey} />
          </CardContent>
        </Card>
      )}

      {!loading && listTotal > 0 && selectedSchoolIds.length === 0 && (
        <Alert message="Mesaj göndermek için listeden en az bir okul seçin (filtre sonrası «Listelenenlerin tümünü seç» kullanabilirsiniz)." />
      )}
    </div>
  );
}
