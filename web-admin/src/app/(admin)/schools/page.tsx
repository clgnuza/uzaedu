'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Plus, School, Search, ChevronRight, Upload } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { Toolbar, ToolbarHeading, ToolbarPageTitle, ToolbarActions } from '@/components/layout/toolbar';
import { ToolbarIconHints } from '@/components/layout/toolbar-icon-hints';
import { Dialog, DialogTrigger, DialogContent } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { SchoolBulkImport } from '@/components/school-bulk-import';
import { TURKEY_CITIES, getDistrictsForCity } from '@/lib/turkey-addresses';

type SchoolItem = {
  id: string;
  name: string;
  type: string;
  segment: string;
  city: string | null;
  district: string | null;
  status: string;
  teacher_limit: number;
  enabled_modules: string[] | null;
  created_at: string;
};

type ListResponse = { total: number; page: number; limit: number; items: SchoolItem[] };

const SCHOOL_TYPE_LABELS: Record<string, string> = { ilkokul: 'İlkokul', ortaokul: 'Ortaokul', lise: 'Lise', bilsem: 'BİLSEM' };
const SCHOOL_SEGMENT_LABELS: Record<string, string> = { ozel: 'Özel', devlet: 'Devlet' };
const SCHOOL_STATUS_LABELS: Record<string, string> = { deneme: 'Deneme', aktif: 'Aktif', askida: 'Askıda' };

function buildSchoolsQuery(params: { page: number; limit: number; city?: string; district?: string; status?: string; type?: string; segment?: string; search?: string }) {
  const u = new URLSearchParams();
  u.set('page', String(params.page));
  u.set('limit', String(params.limit));
  if (params.city?.trim()) u.set('city', params.city.trim());
  if (params.district?.trim()) u.set('district', params.district.trim());
  if (params.status) u.set('status', params.status);
  if (params.type) u.set('type', params.type);
  if (params.segment) u.set('segment', params.segment);
  if (params.search?.trim()) u.set('search', params.search.trim());
  return u.toString();
}

export default function SchoolsPage() {
  const searchParams = useSearchParams();
  const { token, me } = useAuth();
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [filters, setFilters] = useState({ city: '', district: '', status: '', type: '', segment: '', search: '' });
  const limit = 25;
  const isSuperadmin = me?.role === 'superadmin';

  const fetchList = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const q = buildSchoolsQuery({ ...filters, page, limit });
      const res = await apiFetch<ListResponse>(`/schools?${q}`, { token });
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Liste yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [token, page, filters.city, filters.district, filters.status, filters.type, filters.segment, filters.search]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    const st = searchParams?.get('status');
    if (st === 'deneme' || st === 'aktif' || st === 'askida') {
      setFilters((f) => ({ ...f, status: st }));
      setPage(1);
    }
  }, [searchParams]);

  return (
    <div className="space-y-6">
      <Toolbar>
        <ToolbarHeading>
          <ToolbarPageTitle>Okullar</ToolbarPageTitle>
          <ToolbarIconHints
            items={[
              { label: 'Okul listesi', icon: School },
              { label: 'Toplu yükle', icon: Upload },
              { label: 'Yeni okul', icon: Plus },
            ]}
            summary="Okul listesi ve yönetimi (superadmin)"
          />
        </ToolbarHeading>
        {isSuperadmin && (
          <ToolbarActions>
            <div className="flex flex-wrap gap-2">
              <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted"
                  >
                    <Upload className="size-4" />
                    Toplu yükle
                  </button>
                </DialogTrigger>
                <DialogContent title="Toplu okul içe aktarma" className="max-w-2xl">
                  <SchoolBulkImport
                    token={token}
                    onSuccess={() => {
                      setBulkOpen(false);
                      fetchList();
                    }}
                    onCancel={() => setBulkOpen(false)}
                  />
                </DialogContent>
              </Dialog>
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90"
                  >
                    <Plus className="size-4" />
                    Yeni okul
                  </button>
                </DialogTrigger>
                <DialogContent title="Yeni okul" className="max-w-lg">
                  <CreateSchoolForm
                    token={token}
                    onSuccess={() => {
                      setCreateOpen(false);
                      fetchList();
                    }}
                    onCancel={() => setCreateOpen(false)}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </ToolbarActions>
        )}
      </Toolbar>

      <Card>
        <CardHeader>
          <CardTitle>Okul listesi</CardTitle>
          {error && <Alert message={error} className="mt-2" />}
          {isSuperadmin && (
            <form
              onSubmit={(e) => { e.preventDefault(); setPage(1); fetchList(); }}
              className="mt-4 flex flex-wrap items-end gap-3"
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
                <label className="block text-xs font-medium text-muted-foreground">Durum</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
                  className="mt-0.5 w-28 rounded border border-input bg-background px-2.5 py-1.5 text-sm"
                >
                  <option value="">Tümü</option>
                  <option value="aktif">Aktif</option>
                  <option value="deneme">Deneme</option>
                  <option value="askida">Askıda</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Tür</label>
                <select
                  value={filters.type}
                  onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
                  className="mt-0.5 w-28 rounded border border-input bg-background px-2.5 py-1.5 text-sm"
                >
                  <option value="">Tümü</option>
                  <option value="ilkokul">İlkokul</option>
                  <option value="ortaokul">Ortaokul</option>
                  <option value="lise">Lise</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Segment</label>
                <select
                  value={filters.segment}
                  onChange={(e) => setFilters((f) => ({ ...f, segment: e.target.value }))}
                  className="mt-0.5 w-28 rounded border border-input bg-background px-2.5 py-1.5 text-sm"
                >
                  <option value="">Tümü</option>
                  <option value="devlet">Devlet</option>
                  <option value="ozel">Özel</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Arama</label>
                <div className="mt-0.5 flex rounded border border-input bg-background">
                  <Search className="size-4 self-center ml-2 text-muted-foreground" />
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
          )}
        </CardHeader>
        <CardContent className="pt-0">
        {loading ? (
          <LoadingSpinner label="Okul listesi yükleniyor…" />
        ) : data && data.items.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Okul adı
                    </th>
                    <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Tür
                    </th>
                    <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Segment
                    </th>
                    <th className="hidden px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">
                      İlçe
                    </th>
                    <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Durum
                    </th>
                    <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Limit
                    </th>
                    {isSuperadmin && (
                      <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        İşlem
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.items.map((s) => (
                    <tr key={s.id} className="transition-colors hover:bg-muted/40">
                      <td className="px-5 py-4 font-medium text-foreground">{s.name}</td>
                      <td className="px-5 py-4 text-muted-foreground">
                        {SCHOOL_TYPE_LABELS[s.type] ?? s.type}
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">
                        {SCHOOL_SEGMENT_LABELS[s.segment] ?? s.segment}
                      </td>
                      <td className="hidden px-5 py-4 text-muted-foreground md:table-cell">
                        {[s.city, s.district].filter(Boolean).join(' / ') || '—'}
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">
                        {SCHOOL_STATUS_LABELS[s.status] ?? s.status}
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">{s.teacher_limit}</td>
                      {isSuperadmin && (
                        <td className="px-5 py-4 text-right">
                          <Link
                            href={`/schools/${s.id}`}
                            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                          >
                            Detay
                            <ChevronRight className="size-4" />
                          </Link>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.total > limit && (
              <div className="flex items-center justify-between border-t border-border pt-4 mt-4">
                <p className="text-sm text-muted-foreground">Toplam {data.total} okul</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    aria-label="Önceki sayfa"
                    className="rounded-lg border border-border bg-background px-3.5 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted"
                  >
                    Önceki
                  </button>
                  <button
                    type="button"
                    disabled={page * limit >= data.total}
                    onClick={() => setPage((p) => p + 1)}
                    aria-label="Sonraki sayfa"
                    className="rounded-lg border border-border bg-background px-3.5 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted"
                  >
                    Sonraki
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <EmptyState
            icon={<School />}
            title="Henüz okul yok"
            description="İlk okulu ekleyerek başlayabilirsiniz."
            action={
              isSuperadmin ? (
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="text-sm font-medium text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
                >
                  İlk okulu ekle
                </button>
              ) : undefined
            }
          />
        )}
        </CardContent>
      </Card>
    </div>
  );
}

function CreateSchoolForm({
  token,
  onSuccess,
  onCancel,
}: {
  token: string | null;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<string>('lise');
  const [segment, setSegment] = useState<string>('devlet');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [phone, setPhone] = useState('');
  const [about, setAbout] = useState('');
  const [status, setStatus] = useState<string>('aktif');
  const [teacherLimit, setTeacherLimit] = useState(100);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch('/schools', {
        method: 'POST',
        token,
        body: JSON.stringify({
          name: name.trim(),
          type,
          segment,
          city: city.trim() || undefined,
          district: district.trim() || undefined,
          website_url: websiteUrl.trim() || undefined,
          phone: phone.trim() || undefined,
          about_description: about.trim() || undefined,
          status,
          teacher_limit: teacherLimit,
        }),
      });
      toast.success('Okul oluşturuldu');
      onSuccess();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Kaydedilemedi';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <Alert message={error} />}
      <div>
        <label htmlFor="school-name" className="block text-sm font-medium text-foreground">
          Okul adı <span className="text-destructive">*</span>
        </label>
        <input
          id="school-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={255}
          required
          className="mt-1.5 w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground">Tür</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
          >
            <option value="ilkokul">İlkokul</option>
            <option value="ortaokul">Ortaokul</option>
            <option value="lise">Lise</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">Segment</label>
          <select
            value={segment}
            onChange={(e) => setSegment(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
          >
            <option value="devlet">Devlet</option>
            <option value="ozel">Özel</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="school-website" className="block text-sm font-medium text-foreground">Web sitesi</label>
          <input
            id="school-website"
            type="url"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://..."
            maxLength={512}
            className="mt-1.5 w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
          />
        </div>
        <div>
          <label htmlFor="school-phone" className="block text-sm font-medium text-foreground">Telefon</label>
          <input
            id="school-phone"
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0312 555 00 00"
            maxLength={32}
            className="mt-1.5 w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
          />
        </div>
      </div>
      <div>
        <label htmlFor="school-about" className="block text-sm font-medium text-foreground">Detaylı Bilgi (Okulumuz Hakkında)</label>
        <textarea
          id="school-about"
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          placeholder="Okul hakkında kısa tanıtım..."
          rows={3}
          className="mt-1.5 w-full resize-none rounded-lg border border-input bg-background px-4 py-2.5 text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="school-city" className="block text-sm font-medium text-foreground">İl</label>
          <select
            id="school-city"
            value={city}
            onChange={(e) => { setCity(e.target.value); setDistrict(''); }}
            className="mt-1.5 w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
          >
            <option value="">Seçin</option>
            {TURKEY_CITIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="school-district" className="block text-sm font-medium text-foreground">İlçe</label>
          {getDistrictsForCity(city, []).length > 0 ? (
            <select
              id="school-district"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
            >
              <option value="">Seçin</option>
              {getDistrictsForCity(city, []).map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          ) : (
            <input
              id="school-district"
              type="text"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              placeholder="İlçe adı yazın"
              maxLength={100}
              className="mt-1.5 w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
            />
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground">Durum</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
          >
            <option value="deneme">Deneme</option>
            <option value="aktif">Aktif</option>
            <option value="askida">Askıda</option>
          </select>
        </div>
        <div>
          <label htmlFor="school-limit" className="block text-sm font-medium text-foreground">Öğretmen limiti</label>
          <input
            id="school-limit"
            type="number"
            min={1}
            value={teacherLimit}
            onChange={(e) => setTeacherLimit(parseInt(e.target.value, 10) || 100)}
            className="mt-1.5 w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted">
          İptal
        </button>
        <button
          type="submit"
          disabled={submitting || !name.trim()}
          aria-busy={submitting}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>
    </form>
  );
}
