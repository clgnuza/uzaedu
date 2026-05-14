'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { dtUrl } from '@/lib/dt-url';
import { ToolbarHeading, ToolbarPageTitle, ToolbarDescription } from '@/components/layout/toolbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { ForbiddenView } from '@/components/errors/forbidden-view';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronLeft, Folder, Info, Library, Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { DtInfoHint } from '@/components/dogrudan-temin/dt-info-hint';
import { SchoolSelectWithFilter } from '@/components/school-select-with-filter';
import { DT_INPUT_SM, DT_SELECT_SM } from '@/lib/dt-ui';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const PAGE = 200;

type MatCategory = { id: string; name: string; parentId: string | null };
type MatLibItem = {
  id: string;
  code: string;
  name: string;
  unit: string | null;
  vatRate: number;
  description?: string | null;
  categoryId?: string | null;
};

export default function DtMaterialLibraryPage() {
  const { token, me } = useAuth();
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
  const [busy, setBusy] = useState(false);
  const [categories, setCategories] = useState<MatCategory[]>([]);
  const [items, setItems] = useState<MatLibItem[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const [newCatName, setNewCatName] = useState('');
  const [showNewCatDialog, setShowNewCatDialog] = useState(false);

  const [newItemCode, setNewItemCode] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('');
  const [newItemVat, setNewItemVat] = useState('20');
  const [showNewItemDialog, setShowNewItemDialog] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editCode, setEditCode] = useState('');
  const [editName, setEditName] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editVat, setEditVat] = useState('20');
  const [editDesc, setEditDesc] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const setSchool = useCallback(
    (sid: string) => {
      setSelectedSchoolId(sid);
      const u = new URLSearchParams(searchParams.toString());
      if (sid) u.set('school_id', sid);
      else u.delete('school_id');
      router.replace(`/dogrudan-temin/malzeme-kutuphanesi?${u.toString()}`);
    },
    [router, searchParams],
  );

  const fetchPage = useCallback(
    async (append: boolean) => {
      if (!canFetch || !ok) return;
      setLoading(!append);
      setError(null);
      try {
        const skip = append ? items.length : 0;
        const q = new URLSearchParams();
        if (selectedCategoryId) q.set('category_id', selectedCategoryId);
        if (search.trim()) q.set('search', search.trim());
        q.set('limit', String(PAGE));
        q.set('skip', String(skip));
        const libPath = `/dogrudan-temin/materials/library?${q.toString()}`;
        const [catsRes, itemsRes] = await Promise.all([
          apiFetch<{ items: MatCategory[] }>(dtUrl('/dogrudan-temin/materials/categories', me?.role, schoolId), { token }),
          apiFetch<{ items: MatLibItem[]; count: number }>(dtUrl(libPath, me?.role, schoolId), { token }),
        ]);
        setCategories(catsRes.items ?? []);
        setTotal(itemsRes.count ?? 0);
        setItems((prev) => (append ? [...prev, ...(itemsRes.items ?? [])] : itemsRes.items ?? []));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Yüklenemedi');
      } finally {
        setLoading(false);
      }
    },
    [canFetch, items.length, me?.role, ok, schoolId, search, selectedCategoryId, token],
  );

  useEffect(() => {
    if (!canFetch || !ok) return;
    setItems([]);
    void fetchPage(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset list when filters / school change
  }, [canFetch, ok, schoolId, selectedCategoryId, search, me?.role, token]);

  const loadMore = useCallback(() => {
    if (items.length >= total || loading || busy) return;
    void fetchPage(true);
  }, [busy, fetchPage, items.length, loading, total]);

  const addCategory = useCallback(async () => {
    if (!canFetch || !newCatName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(dtUrl('/dogrudan-temin/materials/categories', me?.role, schoolId), {
        token,
        method: 'POST',
        body: JSON.stringify({ name: newCatName.trim(), parent_id: null }),
      });
      setNewCatName('');
      setShowNewCatDialog(false);
      toast.success('Kategori eklendi.');
      await fetchPage(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hata');
    } finally {
      setBusy(false);
    }
  }, [canFetch, fetchPage, me?.role, newCatName, schoolId, token]);

  const addItem = useCallback(async () => {
    if (!canFetch || !newItemCode.trim() || !newItemName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(dtUrl('/dogrudan-temin/materials/library', me?.role, schoolId), {
        token,
        method: 'POST',
        body: JSON.stringify({
          code: newItemCode.trim(),
          name: newItemName.trim(),
          unit: newItemUnit.trim() || null,
          vat_rate: Number(newItemVat) || 20,
          category_id: selectedCategoryId || null,
        }),
      });
      setNewItemCode('');
      setNewItemName('');
      setNewItemUnit('');
      setNewItemVat('20');
      setShowNewItemDialog(false);
      toast.success('Malzeme eklendi.');
      await fetchPage(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hata');
    } finally {
      setBusy(false);
    }
  }, [canFetch, fetchPage, me?.role, newItemCode, newItemName, newItemUnit, newItemVat, schoolId, selectedCategoryId, token]);

  const seedCatalog = useCallback(async () => {
    if (!canFetch) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ inserted: number; skipped_existing: number; catalog_rows: number }>(
        dtUrl('/dogrudan-temin/materials/library/seed-ortak-kamu-catalog', me?.role, schoolId),
        { token, method: 'POST', body: '{}' },
      );
      toast.success(
        `Ortak Kamu Sözlüğü: +${res.inserted} yeni, ${res.skipped_existing} zaten vardı (toplam ${res.catalog_rows} CPV).`,
      );
      await fetchPage(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hata');
    } finally {
      setBusy(false);
    }
  }, [canFetch, fetchPage, me?.role, schoolId, token]);

  const openEdit = useCallback((item: MatLibItem) => {
    setEditId(item.id);
    setEditCode(item.code);
    setEditName(item.name);
    setEditUnit(item.unit ?? '');
    setEditVat(String(item.vatRate ?? 20));
    setEditDesc(item.description ?? '');
    setEditCategoryId(item.categoryId ?? '');
    setEditOpen(true);
  }, []);

  const saveEdit = useCallback(async () => {
    if (!canFetch || !editId || !editCode.trim() || !editName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(dtUrl(`/dogrudan-temin/materials/library/${editId}`, me?.role, schoolId), {
        token,
        method: 'PATCH',
        body: JSON.stringify({
          code: editCode.trim(),
          name: editName.trim(),
          unit: editUnit.trim() || null,
          vat_rate: Number(editVat) || 20,
          description: editDesc.trim() || null,
          category_id: editCategoryId || null,
        }),
      });
      setEditOpen(false);
      setEditId(null);
      toast.success('Malzeme güncellendi.');
      await fetchPage(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hata');
    } finally {
      setBusy(false);
    }
  }, [canFetch, editCode, editDesc, editId, editName, editUnit, editVat, editCategoryId, fetchPage, me?.role, schoolId, token]);

  if (!ok) return <ForbiddenView description="Bu okulda Doğrudan Temin modülü kapalı." />;

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-2 pb-10 pt-1 text-xs sm:px-0">
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <Link
          href={dtUrl('/dogrudan-temin', me?.role, schoolId)}
          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
        >
          <ChevronLeft className="size-3.5" />
          Doğrudan temin
        </Link>
        <span aria-hidden>/</span>
        <span className="text-foreground">Malzeme kütüphanesi</span>
      </div>

      <header className="rounded-2xl border border-border/60 bg-gradient-to-br from-emerald-50/90 via-background to-teal-50/50 p-4 shadow-sm dark:from-emerald-950/25 dark:via-background dark:to-teal-950/20 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 flex-wrap items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
              <Library className="size-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <ToolbarHeading>
                <ToolbarPageTitle className="text-lg sm:text-xl">Malzeme kütüphanesi (CPV)</ToolbarPageTitle>
                <ToolbarDescription>
                  Okul genelinde tekrar kullanılabilir kalem şablonları. Ortak Kamu Alımları Sözlüğü ile 9449 CPV kodunu tek
                  tıkla ekleyebilirsiniz; mevcut kodlar atlanır.
                </ToolbarDescription>
              </ToolbarHeading>
              <div className="flex flex-wrap gap-2">
                <Button className="h-9 gap-1.5" disabled={!canFetch || busy} variant="secondary" onClick={() => void seedCatalog()}>
                  Ortak Kamu sözlüğünü yükle
                </Button>
                <Button className="h-9 gap-1.5" disabled={!canFetch || busy} variant="outline" onClick={() => setShowNewItemDialog(true)}>
                  <Plus className="size-4" />
                  Yeni malzeme
                </Button>
              </div>
            </div>
          </div>
          {isSuperadmin ? (
            <div className="w-full min-w-0 sm:w-[min(320px,100%)]">
              <div className="mb-1 flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                Okul
                <DtInfoHint title="Hangi okulun malzeme kütüphanesini düzenlediğinizi seçin." />
              </div>
              <SchoolSelectWithFilter value={schoolId} onChange={setSchool} token={token} />
            </div>
          ) : null}
        </div>
      </header>

      <div className="flex gap-2 rounded-xl border border-emerald-200/45 bg-emerald-500/8 p-3 dark:border-emerald-500/20 dark:bg-emerald-950/25">
        <Info className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-300" aria-hidden />
        <p className="text-[11px] leading-relaxed text-emerald-950/90 dark:text-emerald-50/90">
          <span className="font-semibold text-foreground">İpucu:</span> CPV kodu ile arama yapın; listeyi sayfa sayfa yükleyin.
          Doğrudan temin dosyasına aktarım şimdilik manuel (kopyala-yapıştır) ile yapılabilir.
        </p>
      </div>

      {error && <Alert message={error} />}

      {!canFetch ? (
        <Alert variant="info" message={isSuperadmin ? 'Önce okul seçin.' : 'Oturum yükleniyor…'} />
      ) : loading && items.length === 0 ? (
        <LoadingSpinner label="Yükleniyor…" className="py-10" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-4">
          <Card className="lg:col-span-1">
            <CardHeader className="py-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Folder className="size-4 text-primary" />
                Kategoriler
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                disabled={busy}
                onClick={() => setShowNewCatDialog(true)}
              >
                <Plus className="size-3.5" />
                Yeni kategori
              </Button>

              {showNewCatDialog && (
                <div className="space-y-2 rounded-md border border-primary/20 bg-primary/5 p-2">
                  <Input
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="Kategori adı"
                    className={DT_INPUT_SM}
                  />
                  <div className="flex gap-1">
                    <Button size="sm" className="h-8 flex-1 text-xs" disabled={busy || !newCatName.trim()} onClick={() => void addCategory()}>
                      Ekle
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 flex-1 text-xs"
                      onClick={() => {
                        setShowNewCatDialog(false);
                        setNewCatName('');
                      }}
                    >
                      İptal
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setSelectedCategoryId('')}
                  className={`w-full rounded px-2 py-1.5 text-left text-xs transition ${
                    selectedCategoryId === '' ? 'bg-primary text-white' : 'bg-muted hover:bg-muted/70'
                  }`}
                >
                  Tümü
                </button>
                {categories.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => setSelectedCategoryId(c.id)}
                    className={`w-full rounded px-2 py-1.5 text-left text-xs transition ${
                      selectedCategoryId === c.id ? 'bg-primary text-white' : 'bg-muted hover:bg-muted/70'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-sm">
                  Malzeme listesi
                  <span className="ml-2 font-normal text-muted-foreground">
                    {total ? `${items.length} / ${total}` : '0'}
                  </span>
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {showNewItemDialog && (
                <div className="space-y-2 rounded-md border border-primary/20 bg-primary/5 p-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-muted-foreground">Kod</label>
                      <Input value={newItemCode} onChange={(e) => setNewItemCode(e.target.value)} placeholder="CPV veya iç kod" className={DT_INPUT_SM} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-muted-foreground">Adı</label>
                      <Input value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="Açıklama" className={DT_INPUT_SM} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-muted-foreground">Birim</label>
                      <Input value={newItemUnit} onChange={(e) => setNewItemUnit(e.target.value)} placeholder="Adet" className={DT_INPUT_SM} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-muted-foreground">KDV %</label>
                      <Input
                        value={newItemVat}
                        onChange={(e) => setNewItemVat(e.target.value)}
                        className={DT_INPUT_SM}
                        type="number"
                        min={0}
                        max={100}
                      />
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      className="h-8 flex-1 text-xs"
                      disabled={busy || !newItemCode.trim() || !newItemName.trim()}
                      onClick={() => void addItem()}
                    >
                      Ekle
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 flex-1 text-xs"
                      onClick={() => {
                        setShowNewItemDialog(false);
                        setNewItemCode('');
                        setNewItemName('');
                        setNewItemUnit('');
                        setNewItemVat('20');
                      }}
                    >
                      İptal
                    </Button>
                  </div>
                </div>
              )}

              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Ara (CPV kodu / ad)…"
                className={DT_INPUT_SM}
              />

              {items.length ? (
                <>
                  <div className="table-x-scroll max-h-[min(70vh,720px)] overflow-auto rounded-md border border-border text-xs">
                    <table className="w-full min-w-[560px] text-left">
                      <thead className="sticky top-0 z-[1] border-b border-border bg-muted/95 backdrop-blur">
                        <tr className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          <th className="px-2 py-1.5">Kod</th>
                          <th className="px-2 py-1.5">Adı</th>
                          <th className="px-2 py-1.5">Birim</th>
                          <th className="px-2 py-1.5 text-right">KDV %</th>
                          <th className="w-px whitespace-nowrap px-2 py-1.5 text-right"> </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {items.map((item) => (
                          <tr key={item.id} className="hover:bg-muted/30">
                            <td className="px-2 py-1 font-mono font-semibold text-primary">{item.code}</td>
                            <td className="px-2 py-1">{item.name}</td>
                            <td className="px-2 py-1 text-muted-foreground">{item.unit ?? '—'}</td>
                            <td className="px-2 py-1 text-right">{item.vatRate}</td>
                            <td className="px-1 py-0.5 text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                disabled={busy}
                                aria-label="Düzenle"
                                onClick={() => openEdit(item)}
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {items.length < total ? (
                    <div className="flex justify-center">
                      <Button variant="outline" size="sm" disabled={busy || loading} onClick={() => void loadMore()}>
                        {loading ? 'Yükleniyor…' : 'Daha fazla göster'}
                      </Button>
                    </div>
                  ) : null}
                </>
              ) : !loading ? (
                <p className="text-center text-[11px] text-muted-foreground">Henüz malzeme yok veya arama sonucu boş.</p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}
      <Dialog
        open={editOpen}
        onOpenChange={(o) => {
          setEditOpen(o);
          if (!o) setEditId(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Malzemeyi düzenle</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <label className="text-[10px] font-semibold text-muted-foreground">Kategori</label>
              <select
                className={DT_SELECT_SM}
                value={editCategoryId}
                onChange={(e) => setEditCategoryId(e.target.value)}
              >
                <option value="">(Yok)</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-muted-foreground">Kod</label>
              <Input value={editCode} onChange={(e) => setEditCode(e.target.value)} className={DT_INPUT_SM} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-muted-foreground">KDV %</label>
              <Input
                value={editVat}
                onChange={(e) => setEditVat(e.target.value)}
                className={DT_INPUT_SM}
                type="number"
                min={0}
                max={100}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-[10px] font-semibold text-muted-foreground">Adı</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} className={DT_INPUT_SM} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-muted-foreground">Birim</label>
              <Input value={editUnit} onChange={(e) => setEditUnit(e.target.value)} className={DT_INPUT_SM} placeholder="Adet" />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-[10px] font-semibold text-muted-foreground">Açıklama (opsiyonel)</label>
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={3}
                className={`${DT_INPUT_SM} min-h-[4.5rem] w-full resize-y`}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2 border-t border-border/50 pt-3">
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={busy}>
              İptal
            </Button>
            <Button onClick={() => void saveEdit()} disabled={busy || !editCode.trim() || !editName.trim()}>
              Kaydet
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
