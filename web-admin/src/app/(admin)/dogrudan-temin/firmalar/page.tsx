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
import { Building2, Plus } from 'lucide-react';
import { ToolbarActions } from '@/components/layout/toolbar';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SchoolSelectWithFilter } from '@/components/school-select-with-filter';

type VendorItem = {
  id: string;
  title: string;
  taxNo: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
};

export default function DogrudanTeminVendorsPage() {
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
  const [items, setItems] = useState<VendorItem[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: '',
    tax_no: '',
    contact_name: '',
    phone: '',
    email: '',
  });

  const fetchVendors = useCallback(async () => {
    if (!token) return;
    if (isSuperadmin && !schoolId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ items: VendorItem[] }>(dtUrl('/dogrudan-temin/vendors', me?.role, schoolId), { token });
      setItems(res.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [isSuperadmin, me?.role, schoolId, token]);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  const createVendor = useCallback(async () => {
    if (!canFetch) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(dtUrl('/dogrudan-temin/vendors', me?.role, schoolId), {
        token,
        method: 'POST',
        body: JSON.stringify({
          title: form.title,
          tax_no: form.tax_no || null,
          contact_name: form.contact_name || null,
          phone: form.phone || null,
          email: form.email || null,
        }),
      });
      setCreateOpen(false);
      setForm({ title: '', tax_no: '', contact_name: '', phone: '', email: '' });
      await fetchVendors();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hata');
    } finally {
      setBusy(false);
    }
  }, [canFetch, fetchVendors, form.contact_name, form.email, form.phone, form.tax_no, form.title, me?.role, schoolId, token]);

  const setSchool = useCallback(
    (sid: string) => {
      setSelectedSchoolId(sid);
      const u = new URLSearchParams(searchParams.toString());
      if (sid) u.set('school_id', sid);
      else u.delete('school_id');
      router.replace(`/dogrudan-temin/firmalar?${u.toString()}`);
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
          <ToolbarPageTitle className="text-base">DT Firmalar</ToolbarPageTitle>
          <ToolbarIconHints items={[{ label: 'Firma havuzu', icon: Building2 }]} summary="Liste (phase)." />
        </ToolbarHeading>
        <ToolbarActions>
          {isSuperadmin ? (
            <div className="w-[320px] max-w-[70vw]">
              <SchoolSelectWithFilter value={schoolId} onChange={setSchool} token={token} />
            </div>
          ) : null}
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={!ok || !canFetch}>
                <Plus className="size-4" />
                Yeni firma
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="text-[11px] text-muted-foreground">Firma adı</div>
                  <Input value={form.title} onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <div className="text-[11px] text-muted-foreground">Vergi No</div>
                    <Input value={form.tax_no} onChange={(e) => setForm((s) => ({ ...s, tax_no: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <div className="text-[11px] text-muted-foreground">Yetkili</div>
                    <Input value={form.contact_name} onChange={(e) => setForm((s) => ({ ...s, contact_name: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <div className="text-[11px] text-muted-foreground">Telefon</div>
                    <Input value={form.phone} onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <div className="text-[11px] text-muted-foreground">E-posta</div>
                    <Input value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={busy}>
                    Vazgeç
                  </Button>
                  <Button onClick={createVendor} disabled={busy || !form.title.trim()}>
                    Kaydet
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
            <div className="table-x-scroll rounded-md border border-border text-xs">
              <table className="w-full min-w-[720px] text-left">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="px-2 py-1.5">Firma</th>
                    <th className="px-2 py-1.5">Vergi No</th>
                    <th className="px-2 py-1.5">Yetkili</th>
                    <th className="px-2 py-1.5">Telefon</th>
                    <th className="px-2 py-1.5">E-posta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((x) => (
                    <tr key={x.id} className="hover:bg-muted/30">
                      <td className="px-2 py-1">{x.title}</td>
                      <td className="px-2 py-1">{x.taxNo ?? '—'}</td>
                      <td className="px-2 py-1">{x.contactName ?? '—'}</td>
                      <td className="px-2 py-1">{x.phone ?? '—'}</td>
                      <td className="px-2 py-1">{x.email ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-6 text-center text-[11px] text-muted-foreground">Kayıt yok.</p>
          )}
        </CardContent>
      </Card>
      )}
    </div>
  );
}

