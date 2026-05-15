'use client';

import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { dtReadonlyLoadFeedback, type DtReadonlyLoadBanner } from '@/lib/dt-readonly-load-error';
import { dtUrl } from '@/lib/dt-url';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { DT_LEGAL_NOTICE, dtFormatNumberTr, dtParseAmount, DT_SELECT_SM } from '@/lib/dt-ui';
import { ForbiddenView } from '@/components/errors/forbidden-view';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Info,
  Layers,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Wallet,
} from 'lucide-react';
import { ToolbarHeading, ToolbarPageTitle, ToolbarDescription } from '@/components/layout/toolbar';
import { SchoolSelectWithFilter } from '@/components/school-select-with-filter';
import { DtInfoHint } from '@/components/dogrudan-temin/dt-info-hint';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { toast } from 'sonner';

type BudgetItem = {
  id: string;
  code: string | null;
  label: string;
  allocated: string;
  blocked: string;
  spent: string;
  has_children: boolean;
};

type FlatBudget = {
  id: string;
  year: number;
  parentId: string | null;
  code: string | null;
  label: string;
  allocated: string;
  blocked: string;
  spent: string;
};

function yearOptions(center: number) {
  const out: number[] = [];
  for (let y = center + 1; y >= center - 6; y--) {
    if (y >= 2000 && y <= 2100) out.push(y);
  }
  return out;
}

function accountOptionLabel(a: FlatBudget) {
  const c = (a.code ?? '').trim();
  const t = (a.label ?? '').trim();
  if (c && t) return `${c} · ${t}`;
  return c || t || a.id.slice(0, 8);
}

export default function DtBudgetHierarchyPage() {
  const { token, me } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSuperadmin = me?.role === 'superadmin' || me?.role === 'moderator';
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(() => searchParams.get('school_id') ?? '');
  const schoolId = isSuperadmin ? selectedSchoolId : ((me as { school_id?: string })?.school_id ?? me?.school?.id ?? '');
  const enabled = me?.school?.enabled_modules ?? null;
  const ok = isSuperadmin || enabled === null || enabled.length === 0 || enabled.includes('dogrudan_temin');
  const canFetch = useMemo(() => !!token && (!isSuperadmin || !!schoolId), [token, isSuperadmin, schoolId]);

  const nowY = new Date().getFullYear();
  const [year, setYear] = useState(() => {
    const y = Number(searchParams.get('year'));
    return y >= 2000 && y <= 2100 ? y : nowY;
  });

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadBanner, setLoadBanner] = useState<DtReadonlyLoadBanner | null>(null);
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [flatAccounts, setFlatAccounts] = useState<FlatBudget[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [childrenCache, setChildrenCache] = useState<Record<string, BudgetItem[]>>({});
  const formRef = useRef<HTMLDivElement | null>(null);

  const [createForm, setCreateForm] = useState({ parent_id: '', code: '', label: '', allocated: '' });
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<FlatBudget | null>(null);
  const [editForm, setEditForm] = useState({ code: '', label: '', allocated: '' });

  const setSchool = useCallback(
    (sid: string) => {
      setSelectedSchoolId(sid);
      const u = new URLSearchParams(searchParams.toString());
      if (sid) u.set('school_id', sid);
      else u.delete('school_id');
      u.set('year', String(year));
      router.replace(`/dogrudan-temin/butce-hierarsisi?${u.toString()}`);
    },
    [router, searchParams, year],
  );

  const setYearAndUrl = useCallback(
    (y: number) => {
      setYear(y);
      const u = new URLSearchParams(searchParams.toString());
      u.set('year', String(y));
      if (isSuperadmin && schoolId) u.set('school_id', schoolId);
      router.replace(`/dogrudan-temin/butce-hierarsisi?${u.toString()}`);
    },
    [isSuperadmin, router, schoolId, searchParams],
  );

  const refreshData = useCallback(async () => {
    if (!canFetch || !ok) return;
    setLoading(true);
    setLoadBanner(null);
    setExpanded(new Set());
    setChildrenCache({});
    try {
      const qs = new URLSearchParams();
      qs.set('year', String(year));
      const [hier, flat] = await Promise.all([
        apiFetch<{ items: BudgetItem[]; year: number }>(
          dtUrl(`/dogrudan-temin/budgets/hierarchy?${qs.toString()}`, me?.role, schoolId),
          { token },
        ),
        apiFetch<{ items: FlatBudget[] }>(dtUrl(`/dogrudan-temin/budgets?${qs.toString()}`, me?.role, schoolId), { token }),
      ]);
      setItems(hier.items ?? []);
      setFlatAccounts(flat.items ?? []);
    } catch (e) {
      setLoadBanner(dtReadonlyLoadFeedback(e));
      setItems([]);
      setFlatAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [canFetch, me?.role, ok, schoolId, token, year]);

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  const toggleExpand = useCallback(
    async (id: string) => {
      if (expanded.has(id)) {
        setExpanded((s) => {
          const next = new Set(s);
          next.delete(id);
          return next;
        });
      } else {
        if (!childrenCache[id]) {
          try {
            const qs = new URLSearchParams();
            qs.set('year', String(year));
            qs.set('parent_id', id);
            const res = await apiFetch<{ items: BudgetItem[]; year: number }>(
              dtUrl(`/dogrudan-temin/budgets/hierarchy?${qs.toString()}`, me?.role, schoolId),
              { token },
            );
            setChildrenCache((s) => ({ ...s, [id]: res.items ?? [] }));
          } catch (e) {
            setLoadBanner(dtReadonlyLoadFeedback(e));
            return;
          }
        }
        setExpanded((s) => new Set(s).add(id));
      }
    },
    [childrenCache, expanded, me?.role, schoolId, token, year],
  );

  const sortedFlat = useMemo(() => {
    return [...flatAccounts].sort((a, b) => {
      const ca = (a.code ?? a.label).toString();
      const cb = (b.code ?? b.label).toString();
      return ca.localeCompare(cb, 'tr');
    });
  }, [flatAccounts]);

  const parentOptions = useMemo(() => sortedFlat, [sortedFlat]);

  const submitCreate = useCallback(async () => {
    if (!token) return;
    if (isSuperadmin && !schoolId) return;
    const code = createForm.code.trim();
    if (!code) {
      toast.error('Bütçe tertibi (kod) zorunludur.');
      return;
    }
    const amt = dtParseAmount(createForm.allocated);
    if (createForm.allocated.trim() && (amt == null || amt < 0)) {
      toast.error('Alınan ödenek geçerli bir sayı olmalıdır.');
      return;
    }
    setBusy(true);
    setLoadBanner(null);
    try {
      const label = createForm.label.trim() || code;
      await apiFetch(dtUrl('/dogrudan-temin/budgets', me?.role, schoolId), {
        token,
        method: 'POST',
        body: JSON.stringify({
          year,
          parent_id: createForm.parent_id.trim() || null,
          code,
          label,
          allocated: createForm.allocated.trim() || '0',
        }),
      });
      toast.success('Bütçe hesabı eklendi.');
      setCreateForm({ parent_id: '', code: '', label: '', allocated: '' });
      await refreshData();
    } catch (e) {
      setLoadBanner(dtReadonlyLoadFeedback(e));
    } finally {
      setBusy(false);
    }
  }, [createForm, isSuperadmin, me?.role, refreshData, schoolId, token, year]);

  const openEdit = useCallback((a: FlatBudget) => {
    setEditing(a);
    const n = dtParseAmount(a.allocated);
    setEditForm({
      code: (a.code ?? '').trim(),
      label: (a.label ?? '').trim(),
      allocated: n == null ? '' : dtFormatNumberTr(n, 2),
    });
    setEditOpen(true);
  }, []);

  const submitEdit = useCallback(async () => {
    if (!token || !editing) return;
    if (isSuperadmin && !schoolId) return;
    const code = editForm.code.trim();
    if (!code) {
      toast.error('Bütçe tertibi (kod) zorunludur.');
      return;
    }
    const amt = dtParseAmount(editForm.allocated);
    if (!editForm.allocated.trim() || amt == null || amt < 0) {
      toast.error('Alınan ödenek geçerli bir sayı olmalıdır.');
      return;
    }
    setBusy(true);
    setLoadBanner(null);
    try {
      const label = editForm.label.trim() || code;
      await apiFetch(dtUrl(`/dogrudan-temin/budgets/${editing.id}`, me?.role, schoolId), {
        token,
        method: 'PATCH',
        body: JSON.stringify({
          code,
          label,
          allocated: editForm.allocated.trim(),
        }),
      });
      toast.success('Kayıt güncellendi.');
      setEditOpen(false);
      setEditing(null);
      await refreshData();
    } catch (e) {
      setLoadBanner(dtReadonlyLoadFeedback(e));
    } finally {
      setBusy(false);
    }
  }, [editForm, editing, isSuperadmin, me?.role, refreshData, schoolId, token]);

  const removeAccount = useCallback(
    async (a: FlatBudget) => {
      if (!token) return;
      if (isSuperadmin && !schoolId) return;
      if (!window.confirm(`Bu bütçe hesabını silmek istiyor musunuz?\n${accountOptionLabel(a)}`)) return;
      setBusy(true);
      setLoadBanner(null);
      try {
        await apiFetch(dtUrl(`/dogrudan-temin/budgets/${a.id}`, me?.role, schoolId), { token, method: 'DELETE' });
        toast.success('Silindi.');
        await refreshData();
      } catch (e) {
        setLoadBanner(dtReadonlyLoadFeedback(e));
      } finally {
        setBusy(false);
      }
    },
    [isSuperadmin, me?.role, refreshData, schoolId, token],
  );

  const setSubAccountOf = useCallback((parentId: string) => {
    setCreateForm((s) => ({ ...s, parent_id: parentId }));
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  if (!ok) return <ForbiddenView description="Bu okulda Doğrudan Temin modülü kapalı." />;

  const yOpts = yearOptions(nowY);

  const renderItem = (item: BudgetItem, level: number = 0): ReactNode => {
    const isExpanded = expanded.has(item.id);
    const children = childrenCache[item.id] ?? [];

    return (
      <div key={item.id} className={level > 0 ? 'border-l border-amber-200/50 pl-2 dark:border-amber-900/40' : ''}>
        <div
          className="flex flex-col gap-2 border-b border-border/50 py-2.5 sm:flex-row sm:items-center sm:gap-3"
          style={{ paddingLeft: level > 0 ? undefined : 0 }}
        >
          <div className="flex min-w-0 flex-1 items-start gap-1.5 sm:items-center">
            {item.has_children ? (
              <button
                type="button"
                onClick={() => void toggleExpand(item.id)}
                className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-border/60 bg-background text-muted-foreground transition hover:bg-muted hover:text-foreground sm:mt-0"
                aria-expanded={isExpanded}
                aria-label={isExpanded ? 'Daralt' : 'Genişlet'}
              >
                {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
              </button>
            ) : (
              <div className="size-7 shrink-0" aria-hidden />
            )}
            <Wallet className="mt-1 size-3.5 shrink-0 text-amber-600 dark:text-amber-400 sm:mt-0" aria-hidden />
            <p className="min-w-0 flex-1 text-[12px] font-medium leading-snug text-foreground">
              <span className="text-muted-foreground">{item.code ? `${item.code} · ` : null}</span>
              {item.label}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 px-1.5 text-[10px]"
              disabled={busy}
              onClick={() => setSubAccountOf(item.id)}
            >
              <Plus className="mr-0.5 size-3" />
              Alt hesap
            </Button>
          </div>
          <div className="grid shrink-0 grid-cols-3 gap-2 text-[10px] tabular-nums sm:flex sm:gap-4 sm:text-[11px]">
            <div className="rounded-md bg-muted/40 px-2 py-1 text-center sm:min-w-[5.5rem] sm:text-right">
              <p className="font-semibold uppercase tracking-wide text-muted-foreground">Ödenek</p>
              <p className="font-medium text-foreground" title="Bu hesaba tahsis edilen yıllık ödenek.">
                {dtFormatNumberTr(item.allocated)} ₺
              </p>
            </div>
            <div className="rounded-md bg-muted/40 px-2 py-1 text-center sm:min-w-[5.5rem] sm:text-right">
              <p className="font-semibold uppercase tracking-wide text-muted-foreground">Bloke</p>
              <p className="font-medium text-foreground" title="Doğrudan temin dosyalarında geçici ayrılmış tutar.">
                {dtFormatNumberTr(item.blocked)} ₺
              </p>
            </div>
            <div className="rounded-md bg-emerald-500/10 px-2 py-1 text-center sm:min-w-[5.5rem] sm:text-right">
              <p className="font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-200">Harcanan</p>
              <p className="font-medium text-emerald-800 dark:text-emerald-200" title="Gerçekleşen harcama / ödemeler.">
                {dtFormatNumberTr(item.spent)} ₺
              </p>
            </div>
          </div>
        </div>

        {isExpanded && children.length > 0 ? (
          <div className="ml-1 space-y-0 border-l border-dashed border-border/70 pl-2">{children.map((c) => renderItem(c, level + 1))}</div>
        ) : null}
        {isExpanded && children.length === 0 ? (
          <p className="ml-8 py-2 text-[11px] text-muted-foreground">Alt hesap yok.</p>
        ) : null}
      </div>
    );
  };

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
        <span className="text-foreground">Bütçe hiyerarşisi</span>
      </div>

      <header className="rounded-2xl border border-border/60 bg-gradient-to-br from-amber-50/90 via-background to-slate-50/60 p-4 shadow-sm dark:from-amber-950/25 dark:via-background dark:to-slate-950/25 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 flex-wrap items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-800 dark:text-amber-200">
              <Layers className="size-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <ToolbarHeading>
                <ToolbarPageTitle className="text-lg sm:text-xl">Bütçe hiyerarşisi</ToolbarPageTitle>
                <ToolbarDescription>
                  Bütçe tertibi (kod) ve alınan ödenekleri buradan tanımlayın. Doğrudan temin dosyalarında bütçe hesabı ve
                  bloke işlemleri yalnızca bu listedeki hesaplardan seçilir.
                </ToolbarDescription>
              </ToolbarHeading>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-medium text-muted-foreground">Yıl</span>
                  <select className={DT_SELECT_SM} value={year} onChange={(e) => setYearAndUrl(Number(e.target.value))}>
                    {yOpts.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1"
                  disabled={!canFetch || loading}
                  onClick={() => void refreshData()}
                >
                  <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
                  Yenile
                </Button>
              </div>
            </div>
          </div>
          {isSuperadmin ? (
            <div className="w-full min-w-0 sm:w-[min(320px,100%)]">
              <div className="mb-1 flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                Okul
                <DtInfoHint title="Hangi okulun bütçe ağacını görüntülediğinizi seçin." />
              </div>
              <SchoolSelectWithFilter value={schoolId} onChange={setSchool} token={token} />
            </div>
          ) : null}
        </div>
      </header>

      <div className="flex gap-2 rounded-xl border border-amber-200/40 bg-amber-500/8 p-3 dark:border-amber-800/30 dark:bg-amber-950/20">
        <Info className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
        <p className="text-[11px] leading-relaxed text-amber-950/90 dark:text-amber-50/90">
          <span className="font-semibold text-foreground">Not:</span> {DT_LEGAL_NOTICE}
        </p>
      </div>

      {loadBanner ? <Alert variant={loadBanner.variant} message={loadBanner.message} /> : null}

      {!canFetch ? (
        <Alert variant="info" message={isSuperadmin ? 'Önce okul seçin.' : 'Oturum yükleniyor…'} />
      ) : (
        <>
          <Card ref={formRef} className="border-border/70 shadow-sm">
            <CardHeader className="border-b border-border/50 py-3">
              <CardTitle className="text-sm">Yeni bütçe hesabı ({year})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-3 sm:p-4">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-muted-foreground">Üst hesap (isteğe bağlı)</label>
                  <select
                    className={DT_SELECT_SM + ' w-full'}
                    value={createForm.parent_id}
                    onChange={(e) => setCreateForm((s) => ({ ...s, parent_id: e.target.value }))}
                  >
                    <option value="">— Kök —</option>
                    {parentOptions.map((a) => (
                      <option key={a.id} value={a.id}>
                        {accountOptionLabel(a)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-muted-foreground">Bütçe tertibi *</label>
                  <Input
                    className="h-9 font-mono text-xs"
                    placeholder="örn. 6.145.399.266.13.73.01.03.02"
                    value={createForm.code}
                    onChange={(e) => setCreateForm((s) => ({ ...s, code: e.target.value }))}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[10px] font-medium text-muted-foreground">Açıklama (boşsa tertip kullanılır)</label>
                  <Input
                    className="h-9 text-xs"
                    placeholder="İsteğe bağlı kısa açıklama"
                    value={createForm.label}
                    onChange={(e) => setCreateForm((s) => ({ ...s, label: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-muted-foreground">Alınan ödenek (₺)</label>
                  <Input
                    className="h-9 text-xs tabular-nums"
                    placeholder="0"
                    value={createForm.allocated}
                    onChange={(e) => setCreateForm((s) => ({ ...s, allocated: e.target.value }))}
                  />
                </div>
                <div className="flex items-end">
                  <Button type="button" size="sm" disabled={busy || loading} onClick={() => void submitCreate()}>
                    Kaydet
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-sm">
            <CardHeader className="border-b border-border/50 py-3">
              <CardTitle className="text-sm">
                Tüm hesaplar <span className="font-normal text-muted-foreground">({year})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading && flatAccounts.length === 0 ? (
                <LoadingSpinner label="Yükleniyor…" className="py-10" />
              ) : sortedFlat.length === 0 ? (
                <p className="px-4 py-8 text-center text-[11px] text-muted-foreground">Henüz kayıt yok; yukarıdan ekleyin.</p>
              ) : (
                <div className="table-x-scroll max-h-[min(50vh,480px)] overflow-auto rounded-b-xl">
                  <table className="w-full min-w-[520px] text-left text-[11px]">
                    <thead>
                      <tr className="sticky top-0 border-b border-border bg-muted/50 font-semibold uppercase tracking-wide text-muted-foreground">
                        <th className="px-3 py-2">Bütçe tertibi</th>
                        <th className="w-16 px-2 py-2 text-center">Yıl</th>
                        <th className="w-36 px-3 py-2 text-right">Alınan ödenek</th>
                        <th className="w-28 px-2 py-2 text-right"> </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {sortedFlat.map((a) => (
                        <tr key={a.id} className="hover:bg-muted/20">
                          <td className="px-3 py-2 font-mono text-[11px] leading-snug">
                            {(a.code ?? '').trim() || '—'}
                            {a.label && (a.code ?? '').trim() !== a.label ? (
                              <span className="mt-0.5 block font-sans text-[10px] text-muted-foreground">{a.label}</span>
                            ) : null}
                          </td>
                          <td className="px-2 py-2 text-center tabular-nums">{a.year}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium">{dtFormatNumberTr(a.allocated)} ₺</td>
                          <td className="px-2 py-2 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 px-1.5"
                              disabled={busy}
                              onClick={() => openEdit(a)}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 px-1.5 text-destructive"
                              disabled={busy}
                              onClick={() => void removeAccount(a)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-sm">
            <CardHeader className="border-b border-border/50 py-3">
              <CardTitle className="text-sm">
                Ağaç görünümü <span className="font-normal text-muted-foreground">({year})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 sm:p-0">
              {loading && items.length === 0 ? (
                <LoadingSpinner label="Yükleniyor…" className="py-12" />
              ) : items.length ? (
                <div className="max-h-[min(72vh,720px)] overflow-y-auto rounded-b-xl">
                  <div className="divide-y divide-border/40 px-2 py-1 sm:px-3">{items.map((item) => renderItem(item, 0))}</div>
                </div>
              ) : (
                <p className="px-4 py-10 text-center text-[11px] text-muted-foreground">Bu yıl için kök bütçe hesabı yok.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md" title="Bütçe hesabını düzenle">
          {editing ? (
            <div className="space-y-3 pt-1">
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground">Bütçe tertibi *</label>
                <Input
                  className="h-9 font-mono text-xs"
                  value={editForm.code}
                  onChange={(e) => setEditForm((s) => ({ ...s, code: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground">Açıklama</label>
                <Input
                  className="h-9 text-xs"
                  value={editForm.label}
                  onChange={(e) => setEditForm((s) => ({ ...s, label: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground">Alınan ödenek (₺)</label>
                <Input
                  className="h-9 text-xs tabular-nums"
                  value={editForm.allocated}
                  onChange={(e) => setEditForm((s) => ({ ...s, allocated: e.target.value }))}
                />
                <p className="text-[10px] text-muted-foreground">
                  Bloke + harcanan toplamından az olamaz (şu an: {dtFormatNumberTr(editing.blocked)} +{' '}
                  {dtFormatNumberTr(editing.spent)}).
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setEditOpen(false)}>
                  Vazgeç
                </Button>
                <Button type="button" size="sm" disabled={busy} onClick={() => void submitEdit()}>
                  Güncelle
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
