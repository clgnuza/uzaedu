'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ForbiddenView } from '@/components/errors/forbidden-view';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { dtReadonlyLoadFeedback, type DtReadonlyLoadBanner } from '@/lib/dt-readonly-load-error';
import { dtUrl } from '@/lib/dt-url';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Alert } from '@/components/ui/alert';
import {
  Building2,
  ChevronLeft,
  Hash,
  Info,
  Mail,
  Pencil,
  Phone,
  Plus,
  Trash2,
  User,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { DtInfoHint } from '@/components/dogrudan-temin/dt-info-hint';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SchoolSelectWithFilter } from '@/components/school-select-with-filter';
import { ToolbarHeading, ToolbarPageTitle, ToolbarDescription } from '@/components/layout/toolbar';
import { DT_INPUT_SM, DT_LEGAL_NOTICE } from '@/lib/dt-ui';
import { cn } from '@/lib/utils';

type VendorItem = {
  id: string;
  title: string;
  taxNo: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address?: string | null;
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
  const [loadBanner, setLoadBanner] = useState<DtReadonlyLoadBanner | null>(null);
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

  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    tax_no: '',
    contact_name: '',
    phone: '',
    email: '',
    address: '',
  });

  const [deleteTarget, setDeleteTarget] = useState<VendorItem | null>(null);

  const fetchVendors = useCallback(async () => {
    if (!token) return;
    if (isSuperadmin && !schoolId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadBanner(null);
    try {
      const res = await apiFetch<{ items: VendorItem[] }>(dtUrl('/dogrudan-temin/vendors', me?.role, schoolId), { token });
      setItems(res.items ?? []);
    } catch (e) {
      setLoadBanner(dtReadonlyLoadFeedback(e));
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
    setLoadBanner(null);
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
      toast.success('Firma kaydedildi.');
      await fetchVendors();
    } catch (e) {
      setLoadBanner(dtReadonlyLoadFeedback(e));
    } finally {
      setBusy(false);
    }
  }, [canFetch, fetchVendors, form.contact_name, form.email, form.phone, form.tax_no, form.title, me?.role, schoolId, token]);

  const openEdit = useCallback((v: VendorItem) => {
    setEditId(v.id);
    setEditForm({
      title: v.title,
      tax_no: v.taxNo ?? '',
      contact_name: v.contactName ?? '',
      phone: v.phone ?? '',
      email: v.email ?? '',
      address: v.address ?? '',
    });
  }, []);

  const saveEdit = useCallback(async () => {
    if (!canFetch || !editId || !editForm.title.trim()) return;
    setBusy(true);
    setLoadBanner(null);
    try {
      await apiFetch(dtUrl(`/dogrudan-temin/vendors/${editId}`, me?.role, schoolId), {
        token,
        method: 'PATCH',
        body: JSON.stringify({
          title: editForm.title.trim(),
          tax_no: editForm.tax_no.trim() || null,
          contact_name: editForm.contact_name.trim() || null,
          phone: editForm.phone.trim() || null,
          email: editForm.email.trim() || null,
          address: editForm.address.trim() || null,
        }),
      });
      setEditId(null);
      toast.success('Firma güncellendi.');
      await fetchVendors();
    } catch (e) {
      setLoadBanner(dtReadonlyLoadFeedback(e));
    } finally {
      setBusy(false);
    }
  }, [canFetch, editForm, editId, fetchVendors, me?.role, schoolId, token]);

  const confirmDelete = useCallback(async () => {
    if (!canFetch || !deleteTarget) return;
    setBusy(true);
    setLoadBanner(null);
    try {
      await apiFetch(dtUrl(`/dogrudan-temin/vendors/${deleteTarget.id}`, me?.role, schoolId), {
        token,
        method: 'DELETE',
      });
      setDeleteTarget(null);
      toast.success('Firma silindi.');
      await fetchVendors();
    } catch (e) {
      setLoadBanner(dtReadonlyLoadFeedback(e));
    } finally {
      setBusy(false);
    }
  }, [canFetch, deleteTarget, fetchVendors, me?.role, schoolId, token]);

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

  if (!ok) return <ForbiddenView description="Bu okulda Doğrudan Temin modülü kapalı." />;

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-2 pb-10 pt-1 text-xs sm:px-0">
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <Link
          href={dtUrl('/dogrudan-temin', me?.role, schoolId)}
          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
        >
          <ChevronLeft className="size-3.5" />
          Doğrudan temin
        </Link>
        <span aria-hidden>/</span>
        <span className="text-foreground">Tedarikçi firmalar</span>
      </div>

      <header className="rounded-2xl border border-border/60 bg-gradient-to-br from-violet-50/90 via-background to-sky-50/50 p-4 shadow-sm dark:from-violet-950/25 dark:via-background dark:to-sky-950/20 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 flex-wrap items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-700 dark:text-violet-300">
              <Users className="size-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <ToolbarHeading>
                <ToolbarPageTitle className="text-lg sm:text-xl">Tedarikçi firmalar (istekliler)</ToolbarPageTitle>
                <ToolbarDescription>
                  Teklif isteme, karar ve sözleşme belgelerinde seçeceğiniz firma kayıtlarıdır. Listeyi okul ihtiyacına göre
                  önceden oluşturmanız iş akışını hızlandırır.
                </ToolbarDescription>
              </ToolbarHeading>
              <div className="flex flex-wrap gap-2">
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                  <DialogTrigger asChild>
                    <Button className="h-9 gap-1.5" disabled={!canFetch}>
                      <Plus className="size-4" />
                      Yeni firma
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <div className="space-y-4">
                      <div className="flex gap-2 rounded-xl border border-violet-200/40 bg-violet-500/8 p-2.5 dark:border-violet-500/25 dark:bg-violet-950/30">
                        <Info className="mt-0.5 size-4 shrink-0 text-violet-600 dark:text-violet-300" aria-hidden />
                        <p className="text-[11px] leading-relaxed text-muted-foreground">
                          Unvanı fatura / MERSİS kaydıyla aynı tutun. İletişim alanları teklif mektubu ve yazışma şablonlarında
                          kullanılabilir.
                          <DtInfoHint title={DT_LEGAL_NOTICE} className="ml-0.5 align-middle" />
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1">
                          <label className="text-[12px] font-medium text-foreground">Firma / ticari unvan *</label>
                          <DtInfoHint title="Teklif ve sözleşmede görünecek resmî kısa veya tam unvan." />
                        </div>
                        <Input
                          value={form.title}
                          onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
                          className={DT_INPUT_SM}
                          placeholder="Örn. ABC Ltd. Şti."
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1">
                            <Hash className="size-3.5 text-muted-foreground" aria-hidden />
                            <label className="text-[12px] font-medium text-foreground">Vergi numarası</label>
                            <DtInfoHint title="Tüzel kişilerde VKN; şahıs firmalarında TCKN olabilir." />
                          </div>
                          <Input
                            value={form.tax_no}
                            onChange={(e) => setForm((s) => ({ ...s, tax_no: e.target.value }))}
                            className={DT_INPUT_SM}
                            placeholder="VKN / TCKN"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1">
                            <User className="size-3.5 text-muted-foreground" aria-hidden />
                            <label className="text-[12px] font-medium text-foreground">Yetkili kişi</label>
                            <DtInfoHint title="Teklif mektubunda imza yetkilisi olarak görünecek kişi (opsiyonel)." />
                          </div>
                          <Input
                            value={form.contact_name}
                            onChange={(e) => setForm((s) => ({ ...s, contact_name: e.target.value }))}
                            className={DT_INPUT_SM}
                            placeholder="Ad Soyad"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1">
                            <Phone className="size-3.5 text-muted-foreground" aria-hidden />
                            <label className="text-[12px] font-medium text-foreground">Telefon</label>
                          </div>
                          <Input
                            value={form.phone}
                            onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
                            className={DT_INPUT_SM}
                            placeholder="+90 …"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1">
                            <Mail className="size-3.5 text-muted-foreground" aria-hidden />
                            <label className="text-[12px] font-medium text-foreground">E-posta</label>
                          </div>
                          <Input
                            type="email"
                            value={form.email}
                            onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                            className={DT_INPUT_SM}
                            placeholder="firma@ornek.com"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 border-t border-border/50 pt-3">
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
              </div>
            </div>
          </div>
          {isSuperadmin ? (
            <div className="w-full min-w-0 sm:w-[min(320px,100%)]">
              <div className="mb-1 flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                Okul
                <DtInfoHint title="Hangi okulun firma listesini düzenlediğinizi seçin." />
              </div>
              <SchoolSelectWithFilter value={schoolId} onChange={setSchool} token={token} />
            </div>
          ) : null}
        </div>
      </header>

      <div className="flex gap-2 rounded-xl border border-sky-200/45 bg-sky-500/8 p-3 dark:border-sky-500/20 dark:bg-sky-950/25">
        <Building2 className="mt-0.5 size-4 shrink-0 text-sky-600 dark:text-sky-300" aria-hidden />
        <p className="text-[11px] leading-relaxed text-sky-950/90 dark:text-sky-50/90">
          <span className="font-semibold text-foreground">İpucu:</span> Vergi numarası ve iletişim bilgileri teklif isteme ve
          sözleşme metinlerine aktarılabilir. Kayıtları güncel tutmak, teklif karşılaştırmasını ve denetim izini kolaylaştırır.
          <DtInfoHint title="Resmî unvanı MERSİS / fatura ünvanı ile aynı tutmanız önerilir." />
        </p>
      </div>

      <Card variant="violet" soft className="min-w-0 overflow-hidden shadow-sm">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground sm:text-base">Firma listesi</h2>
              {!loading ? (
                <span className="inline-flex items-center rounded-full border border-violet-300/40 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-900 dark:text-violet-100">
                  {items.length} kayıt
                </span>
              ) : null}
              <DtInfoHint title="Tablo yatay kaydırılabilir; mobilde sağa kaydırarak tüm sütunları görün." />
            </div>
          </div>

          {loadBanner ? <Alert variant={loadBanner.variant} message={loadBanner.message} /> : null}
          {loading ? (
            <LoadingSpinner label="Firmalar yükleniyor…" className="py-12 text-xs" />
          ) : items.length ? (
            <div className="min-w-0 overflow-x-auto rounded-xl border border-border/70 bg-card/50 shadow-inner">
              <table className="w-full min-w-[800px] table-fixed border-separate border-spacing-0 text-left text-[12px]">
                <colgroup>
                  <col style={{ width: '26%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '96px' }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-border/80 bg-muted/50 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="border-r border-border/50 px-3 py-2.5 text-left last:border-r-0">Firma</th>
                    <th className="border-r border-border/50 px-3 py-2.5 text-left last:border-r-0">Vergi no</th>
                    <th className="border-r border-border/50 px-3 py-2.5 text-left last:border-r-0">Yetkili</th>
                    <th className="border-r border-border/50 px-3 py-2.5 text-left last:border-r-0">Telefon</th>
                    <th className="border-r border-border/50 px-3 py-2.5 text-left last:border-r-0">E-posta</th>
                    <th className="px-2 py-2.5 text-center">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((x, i) => (
                    <tr
                      key={x.id}
                      className={cn(
                        'border-b border-border/60 transition-colors hover:bg-violet-500/[0.06] dark:hover:bg-violet-500/10',
                        i % 2 === 1 && 'bg-muted/25',
                      )}
                    >
                      <td className="min-w-0 border-r border-border/50 px-3 py-2.5 align-top last:border-r-0">
                        <div className="break-words font-medium leading-snug text-foreground" title={x.title}>
                          {x.title}
                        </div>
                      </td>
                      <td className="min-w-0 border-r border-border/50 px-3 py-2.5 align-top font-mono text-[11px] text-muted-foreground last:border-r-0">
                        <div className="break-all" title={x.taxNo ?? undefined}>
                          {x.taxNo ?? '—'}
                        </div>
                      </td>
                      <td className="min-w-0 border-r border-border/50 px-3 py-2.5 align-top last:border-r-0">
                        <div className="truncate text-muted-foreground" title={x.contactName ?? undefined}>
                          {x.contactName ?? '—'}
                        </div>
                      </td>
                      <td className="min-w-0 border-r border-border/50 px-3 py-2.5 align-top whitespace-nowrap text-muted-foreground last:border-r-0">
                        {x.phone ?? '—'}
                      </td>
                      <td className="min-w-0 border-r border-border/50 px-3 py-2.5 align-top last:border-r-0">
                        <div className="break-all text-muted-foreground" title={x.email ?? undefined}>
                          {x.email ?? '—'}
                        </div>
                      </td>
                      <td className="px-1 py-1.5 align-middle text-center">
                        <div className="flex items-center justify-center gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            disabled={busy}
                            aria-label="Düzenle"
                            onClick={() => openEdit(x)}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            disabled={busy}
                            aria-label="Sil"
                            onClick={() => setDeleteTarget(x)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-violet-300/50 bg-gradient-to-br from-violet-500/5 via-muted/15 to-sky-500/5 py-12 text-center dark:border-violet-500/25">
              <Users className="mx-auto mb-3 size-12 text-muted-foreground/25" aria-hidden />
              <p className="text-sm font-medium text-foreground">Henüz firma kaydı yok</p>
              <p className="mx-auto mt-1 max-w-sm text-[12px] text-muted-foreground">
                Teklif sürecine başlamadan önce «Yeni firma» ile istekli firmalarınızı ekleyin; dosya detayında teklif
                oluştururken bu listeden seçim yapılır.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editId} onOpenChange={(open) => !open && setEditId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Firmayı düzenle</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-foreground">Firma / ticari unvan *</label>
              <Input
                value={editForm.title}
                onChange={(e) => setEditForm((s) => ({ ...s, title: e.target.value }))}
                className={DT_INPUT_SM}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-foreground">Vergi numarası</label>
                <Input
                  value={editForm.tax_no}
                  onChange={(e) => setEditForm((s) => ({ ...s, tax_no: e.target.value }))}
                  className={DT_INPUT_SM}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-foreground">Yetkili kişi</label>
                <Input
                  value={editForm.contact_name}
                  onChange={(e) => setEditForm((s) => ({ ...s, contact_name: e.target.value }))}
                  className={DT_INPUT_SM}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-foreground">Telefon</label>
                <Input
                  value={editForm.phone}
                  onChange={(e) => setEditForm((s) => ({ ...s, phone: e.target.value }))}
                  className={DT_INPUT_SM}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-foreground">E-posta</label>
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((s) => ({ ...s, email: e.target.value }))}
                  className={DT_INPUT_SM}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-foreground">Adres (şablonlarda kullanılabilir)</label>
              <textarea
                value={editForm.address}
                onChange={(e) => setEditForm((s) => ({ ...s, address: e.target.value }))}
                rows={3}
                className={`${DT_INPUT_SM} min-h-[4rem] w-full resize-y`}
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-border/50 pt-3">
              <Button variant="outline" onClick={() => setEditId(null)} disabled={busy}>
                Vazgeç
              </Button>
              <Button onClick={() => void saveEdit()} disabled={busy || !editForm.title.trim()}>
                Kaydet
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Firmayı sil</DialogTitle>
          </DialogHeader>
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">{deleteTarget?.title}</span> kaydını silmek istediğinize emin
            misiniz? Bu firmayı kullanan dosyada teklif veya karar varsa silme engellenir.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={busy}>
              Vazgeç
            </Button>
            <Button variant="destructive" onClick={() => void confirmDelete()} disabled={busy}>
              Sil
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
