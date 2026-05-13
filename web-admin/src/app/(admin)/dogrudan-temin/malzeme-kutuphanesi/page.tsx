'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Toolbar, ToolbarHeading, ToolbarPageTitle } from '@/components/layout/toolbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { ForbiddenView } from '@/components/errors/forbidden-view';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronLeft, Plus, Folder } from 'lucide-react';
import Link from 'next/link';

type MatCategory = { id: string; name: string; parentId: string | null };
type MatLibItem = { id: string; code: string; name: string; unit: string | null; vatRate: number };

export default function DtMaterialLibraryPage() {
  const { token, me } = useAuth();
  const enabled = me?.school?.enabled_modules ?? null;
  const ok = enabled === null || enabled.length === 0 || enabled.includes('dogrudan_temin');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [categories, setCategories] = useState<MatCategory[]>([]);
  const [items, setItems] = useState<MatLibItem[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [search, setSearch] = useState('');

  const [newCatName, setNewCatName] = useState('');
  const [showNewCatDialog, setShowNewCatDialog] = useState(false);

  const [newItemCode, setNewItemCode] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('');
  const [newItemVat, setNewItemVat] = useState('20');
  const [showNewItemDialog, setShowNewItemDialog] = useState(false);

  const schoolId = (me as { school_id?: string })?.school_id ?? me?.school?.id ?? '';

  const fetchData = useCallback(async () => {
    if (!token || !ok) return;
    setLoading(true);
    setError(null);
    try {
      const [catsRes, itemsRes] = await Promise.all([
        apiFetch<{ items: MatCategory[] }>('/dogrudan-temin/materials/categories', { token }),
        apiFetch<{ items: MatLibItem[]; count: number }>(
          `/dogrudan-temin/materials/library?category_id=${encodeURIComponent(selectedCategoryId)}&search=${encodeURIComponent(search)}`,
          { token },
        ),
      ]);
      setCategories(catsRes.items ?? []);
      setItems(itemsRes.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [ok, search, selectedCategoryId, token]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const addCategory = useCallback(async () => {
    if (!token || !newCatName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/dogrudan-temin/materials/categories', {
        token,
        method: 'POST',
        body: JSON.stringify({ name: newCatName.trim(), parent_id: null }),
      });
      setNewCatName('');
      setShowNewCatDialog(false);
      await fetchData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hata');
    } finally {
      setBusy(false);
    }
  }, [fetchData, newCatName, token]);

  const addItem = useCallback(async () => {
    if (!token || !newItemCode.trim() || !newItemName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/dogrudan-temin/materials/library', {
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
      await fetchData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hata');
    } finally {
      setBusy(false);
    }
  }, [fetchData, newItemCode, newItemName, newItemUnit, newItemVat, selectedCategoryId, token]);

  if (!ok) return <ForbiddenView description="Bu okulda Doğrudan Temin modülü kapalı." />;

  return (
    <div className="space-y-3 text-xs">
      <Toolbar>
        <ToolbarHeading>
          <div className="flex items-center gap-2">
            <Link href="/dogrudan-temin" className="inline-flex items-center gap-1 text-primary hover:underline">
              <ChevronLeft className="size-3.5" /> Dosyalar
            </Link>
            <span className="text-muted-foreground">/</span>
            <ToolbarPageTitle className="text-base">Malzeme Kütüphanesi</ToolbarPageTitle>
          </div>
        </ToolbarHeading>
      </Toolbar>

      {error && <Alert message={error} />}

      {loading ? (
        <LoadingSpinner label="Yükleniyor…" className="py-10" />
      ) : (
        <div className="grid gap-3 lg:grid-cols-4">
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
                Yeni Kategori
              </Button>

              {showNewCatDialog && (
                <div className="space-y-2 rounded-md border border-primary/20 bg-primary/5 p-2">
                  <Input
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="Kategori adı"
                    className="h-7 text-xs"
                  />
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      className="h-6 flex-1 text-xs"
                      disabled={busy || !newCatName.trim()}
                      onClick={() => void addCategory()}
                    >
                      Ekle
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 flex-1 text-xs"
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
                  onClick={() => setSelectedCategoryId('')}
                  className={`w-full rounded px-2 py-1.5 text-left text-xs transition ${
                    selectedCategoryId === ''
                      ? 'bg-primary text-white'
                      : 'bg-muted hover:bg-muted/70'
                  }`}
                >
                  Tümü
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCategoryId(c.id)}
                    className={`w-full rounded px-2 py-1.5 text-left text-xs transition ${
                      selectedCategoryId === c.id
                        ? 'bg-primary text-white'
                        : 'bg-muted hover:bg-muted/70'
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
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm">Malzeme Listesi</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => setShowNewItemDialog(true)}
                >
                  <Plus className="size-3.5" />
                  Yeni Malzeme
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {showNewItemDialog && (
                <div className="space-y-2 rounded-md border border-primary/20 bg-primary/5 p-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-muted-foreground">Kod</label>
                      <Input
                        value={newItemCode}
                        onChange={(e) => setNewItemCode(e.target.value)}
                        placeholder="KRT-001"
                        className="h-7 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-muted-foreground">Adı</label>
                      <Input
                        value={newItemName}
                        onChange={(e) => setNewItemName(e.target.value)}
                        placeholder="Mandal Büyük Boy"
                        className="h-7 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-muted-foreground">Birim</label>
                      <Input
                        value={newItemUnit}
                        onChange={(e) => setNewItemUnit(e.target.value)}
                        placeholder="Adet"
                        className="h-7 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-muted-foreground">KDV %</label>
                      <Input
                        value={newItemVat}
                        onChange={(e) => setNewItemVat(e.target.value)}
                        className="h-7 text-xs"
                        type="number"
                        min="0"
                        max="100"
                      />
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      className="h-6 flex-1 text-xs"
                      disabled={busy || !newItemCode.trim() || !newItemName.trim()}
                      onClick={() => void addItem()}
                    >
                      Ekle
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 flex-1 text-xs"
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

              <div className="mb-2">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Ara (kod / ad)…"
                  className="h-8 text-xs"
                />
              </div>

              {items.length ? (
                <div className="table-x-scroll rounded-md border border-border text-xs">
                  <table className="w-full min-w-[500px] text-left">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <th className="px-2 py-1.5">Kod</th>
                        <th className="px-2 py-1.5">Adı</th>
                        <th className="px-2 py-1.5">Birim</th>
                        <th className="px-2 py-1.5 text-right">KDV %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {items.map((item) => (
                        <tr key={item.id} className="hover:bg-muted/30">
                          <td className="px-2 py-1 font-mono font-semibold text-primary">{item.code}</td>
                          <td className="px-2 py-1">{item.name}</td>
                          <td className="px-2 py-1 text-muted-foreground">{item.unit ?? '—'}</td>
                          <td className="px-2 py-1 text-right">{item.vatRate}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-[11px] text-muted-foreground">Henüz malzeme yok.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
