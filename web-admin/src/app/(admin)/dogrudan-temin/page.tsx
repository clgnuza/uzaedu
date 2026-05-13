'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Toolbar, ToolbarHeading, ToolbarPageTitle } from '@/components/layout/toolbar';
import { ToolbarIconHints } from '@/components/layout/toolbar-icon-hints';
import { ForbiddenView } from '@/components/errors/forbidden-view';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { dtUrl } from '@/lib/dt-url';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Alert } from '@/components/ui/alert';
import { ClipboardList, Plus } from 'lucide-react';
import Link from 'next/link';
import { ToolbarActions } from '@/components/layout/toolbar';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SchoolSelectWithFilter } from '@/components/school-select-with-filter';

type DtFileItem = {
  id: string;
  year: number;
  fileNo: string;
  subject: string;
  teminType: string;
  status: string;
  createdAt: string;
};

export default function DogrudanTeminPage() {
  const { me, token } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSuperadmin = me?.role === 'superadmin' || me?.role === 'moderator';
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(() => searchParams.get('school_id') ?? '');
  const schoolId = isSuperadmin ? selectedSchoolId : ((me as { school_id?: string })?.school_id ?? me?.school?.id ?? '');
  const enabled = me?.school?.enabled_modules ?? null;
  const ok = isSuperadmin || enabled === null || enabled.length === 0 || enabled.includes('dogrudan_temin');

  const canFetch = useMemo(() => !!token && (!isSuperadmin || !!schoolId), [token, isSuperadmin, schoolId]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<DtFileItem[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const nowYear = useMemo(() => new Date().getFullYear(), []);
  const [filters, setFilters] = useState({ search: '', include_archived: false });
  const [form, setForm] = useState({
    year: String(nowYear),
    file_no: '',
    subject: '',
    temin_type: '22a_mal',
  });

  const fetchFiles = useCallback(async () => {
    if (!token) return;
    if (isSuperadmin && !schoolId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      if (filters.search.trim()) q.set('search', filters.search.trim());
      if (filters.include_archived) q.set('include_archived', '1');
      const path = q.toString() ? `/dogrudan-temin/files?${q.toString()}` : '/dogrudan-temin/files';
      const res = await apiFetch<{ items: DtFileItem[] }>(dtUrl(path, me?.role, schoolId), { token });
      setItems(res.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [filters.include_archived, filters.search, isSuperadmin, me?.role, schoolId, token]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const createFile = useCallback(async () => {
    if (!canFetch) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(dtUrl('/dogrudan-temin/files', me?.role, schoolId), {
        token,
        method: 'POST',
        body: JSON.stringify({
          year: Number(form.year),
          file_no: form.file_no,
          subject: form.subject,
          temin_type: form.temin_type,
        }),
      });
      setCreateOpen(false);
      setForm((s) => ({ ...s, file_no: '', subject: '' }));
      await fetchFiles();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hata');
    } finally {
      setBusy(false);
    }
  }, [canFetch, fetchFiles, form.file_no, form.subject, form.temin_type, form.year, me?.role, schoolId, token]);

  const setSchool = useCallback(
    (sid: string) => {
      setSelectedSchoolId(sid);
      const u = new URLSearchParams(searchParams.toString());
      if (sid) u.set('school_id', sid);
      else u.delete('school_id');
      router.replace(`/dogrudan-temin?${u.toString()}`);
    },
    [router, searchParams],
  );

  return (
    <div className="space-y-3 text-xs">
      {!ok ? (
        <ForbiddenView description="Bu okulda Doğrudan Temin modülü kapalı." />
      ) : null}
      <Toolbar>
        <ToolbarHeading>
          <ToolbarPageTitle className="text-base">Doğrudan Temin</ToolbarPageTitle>
          <ToolbarIconHints
            items={[{ label: 'Dosyalar', icon: ClipboardList }]}
            summary="Dosyalar listesi (phase)."
          />
        </ToolbarHeading>
        <ToolbarActions>
          {isSuperadmin ? (
            <div className="hidden w-[320px] max-w-[60vw] md:block">
              <SchoolSelectWithFilter value={schoolId} onChange={setSchool} token={token} />
            </div>
          ) : null}
          <div className="hidden items-center gap-2 md:flex">
            <div className="flex items-center rounded-md border border-input bg-background px-2">
              <input
                value={filters.search}
                onChange={(e) => setFilters((s) => ({ ...s, search: e.target.value }))}
                placeholder="Ara (no / konu)"
                className="h-8 w-[220px] border-0 bg-transparent text-xs focus:outline-none focus:ring-0"
              />
            </div>
            <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <input
                type="checkbox"
                checked={filters.include_archived}
                onChange={(e) => setFilters((s) => ({ ...s, include_archived: e.target.checked }))}
                className="size-3.5 rounded border-input"
              />
              Arşiv dahil
            </label>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={!ok || !canFetch}>
                <Plus className="size-4" />
                Yeni dosya
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <div className="space-y-4">
                <div>
                  <h2 className="text-base font-semibold">Yeni Doğrudan Temin Dosyası</h2>
                  <p className="text-[11px] text-muted-foreground mt-0.5">İhtiyaç listesi, teklifler ve ödemeler ekleyebilirsiniz.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground uppercase">Yıl *</label>
                    <Input value={form.year} onChange={(e) => setForm((s) => ({ ...s, year: e.target.value }))} className="text-xs" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground uppercase">Dosya No *</label>
                    <Input value={form.file_no} onChange={(e) => setForm((s) => ({ ...s, file_no: e.target.value }))} className="text-xs" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground uppercase">Konu *</label>
                  <Input value={form.subject} onChange={(e) => setForm((s) => ({ ...s, subject: e.target.value }))} className="text-xs" placeholder="Tedarik konusu" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground uppercase">Temin Türü</label>
                  <select
                    value={form.temin_type}
                    onChange={(e) => setForm((s) => ({ ...s, temin_type: e.target.value }))}
                    className="w-full h-9 rounded border border-input bg-background px-2 text-xs"
                  >
                    <option value="22a_mal">Mal Alımı (22/a)</option>
                    <option value="22b_hizmet">Hizmet Alımı (22/b)</option>
                    <option value="22c_yapim">Yapı İşleri (22/c)</option>
                    <option value="22d_dig_isler">Diğer İşler (22/d)</option>
                    <option value="22e_danismanlik">Danışmanlık (22/e)</option>
                    <option value="22f_kirala">Kiralamak (22/f)</option>
                    <option value="22g_isletme">İşletme (22/g)</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-3 border-t">
                  <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={busy}>
                    Vazgeç
                  </Button>
                  <Button onClick={createFile} disabled={busy || !form.file_no.trim() || !form.subject.trim()}>
                    Dosya Oluştur
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </ToolbarActions>
      </Toolbar>

      {!ok ? null : (
      <Card>
        <CardContent className="py-4">
          {error && <Alert message={error} className="mb-2" />}
          {loading ? (
            <LoadingSpinner label="Yükleniyor…" className="py-6 text-xs" />
          ) : items.length ? (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {items.map((x) => (
                <Link
                  key={x.id}
                  href={
                    isSuperadmin && schoolId
                      ? `/dogrudan-temin/${x.id}?school_id=${encodeURIComponent(schoolId)}`
                      : `/dogrudan-temin/${x.id}`
                  }
                >
                  <div className="group h-full rounded-lg border border-border bg-card p-3 hover:border-primary/40 hover:shadow-sm transition-all">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1">
                        <p className="font-semibold text-sm line-clamp-2 group-hover:text-primary transition-colors">{x.subject}</p>
                        <p className="text-[11px] text-muted-foreground">{x.year} · #{x.fileNo}</p>
                      </div>
                      <span className={`px-2 py-1 rounded text-[10px] font-semibold whitespace-nowrap ${
                        x.status === 'draft' ? 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200' :
                        x.status === 'decision' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                        x.status === 'awarded' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                        'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                      }`}>
                        {x.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {x.teminType}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <ClipboardList className="size-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-[11px] text-muted-foreground">Henüz dosya yok.</p>
              <p className="text-[10px] text-muted-foreground mt-1">Başlamak için "Yeni dosya" düğmesini kullanın.</p>
            </div>
          )}
        </CardContent>
      </Card>
      )}
    </div>
  );
}

