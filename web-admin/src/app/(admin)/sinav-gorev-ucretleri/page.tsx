'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch, isAbortError } from '@/lib/api';
import type { ExamDutyFeeCatalog, ExamDutyFeeRoleRow } from '@/lib/exam-duty-fee-catalog';
import { computeExamDutyResult, parseNum } from '@/lib/exam-duty-fee-calc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Building2,
  Calculator,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  GraduationCap,
  Info,
  Landmark,
  Monitor,
  Plus,
  Receipt,
  RotateCcw,
  Save,
  School,
  Settings,
  Share2,
  Trash2,
} from 'lucide-react';

/* ─────────────────────────────────────────────────────── formatters */
const _tlFmt = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  minimumFractionDigits: 2,
});
function formatTL(n: number): string {
  return _tlFmt.format(n);
}

/* ─────────────────────────────────────────────────────── decoration */
function DotPattern() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
      <div
        className="absolute -inset-px opacity-[0.02]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
          backgroundSize: '24px 24px',
        }}
      />
    </div>
  );
}

function CalcSkeleton() {
  return (
    <div className="flex min-w-0 flex-col gap-6 lg:grid lg:grid-cols-[1fr_360px]">
      <div className="min-w-0 space-y-6">
        <Skeleton className="h-56 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
      <Skeleton className="h-80 rounded-2xl lg:sticky lg:top-6 lg:self-start" />
    </div>
  );
}

/* ─────────────────────────────────────────── institution meta */
type CatMeta = {
  icon: React.ReactNode;
  label: string;
  iconBg: string;
  iconColor: string;
  activeBorder: string;
  activeBg: string;
  dotColor: string;
};

const CAT_META: Record<string, CatMeta> = {
  meb_klasik: {
    icon: <School className="size-5" strokeWidth={1.75} />,
    label: 'MEB Ortak & AÖL',
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    iconColor: 'text-blue-600 dark:text-blue-400',
    activeBorder: 'border-blue-400 dark:border-blue-600',
    activeBg: 'bg-blue-50 dark:bg-blue-950/30',
    dotColor: 'bg-blue-500',
  },
  meb_esinav: {
    icon: <Monitor className="size-5" strokeWidth={1.75} />,
    label: 'MEB e-Sınav',
    iconBg: 'bg-indigo-100 dark:bg-indigo-900/30',
    iconColor: 'text-indigo-600 dark:text-indigo-400',
    activeBorder: 'border-indigo-400 dark:border-indigo-600',
    activeBg: 'bg-indigo-50 dark:bg-indigo-950/30',
    dotColor: 'bg-indigo-500',
  },
  osym: {
    icon: <ClipboardList className="size-5" strokeWidth={1.75} />,
    label: 'ÖSYM',
    iconBg: 'bg-violet-100 dark:bg-violet-900/30',
    iconColor: 'text-violet-600 dark:text-violet-400',
    activeBorder: 'border-violet-400 dark:border-violet-600',
    activeBg: 'bg-violet-50 dark:bg-violet-950/30',
    dotColor: 'bg-violet-500',
  },
  anadolu_aof_tr: {
    icon: <GraduationCap className="size-5" strokeWidth={1.75} />,
    label: 'Anadolu AÖF',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    activeBorder: 'border-emerald-400 dark:border-emerald-600',
    activeBg: 'bg-emerald-50 dark:bg-emerald-950/30',
    dotColor: 'bg-emerald-500',
  },
  anadolu_aof_istanbul: {
    icon: <GraduationCap className="size-5" strokeWidth={1.75} />,
    label: 'Anadolu AÖF İst.',
    iconBg: 'bg-teal-100 dark:bg-teal-900/30',
    iconColor: 'text-teal-600 dark:text-teal-400',
    activeBorder: 'border-teal-400 dark:border-teal-600',
    activeBg: 'bg-teal-50 dark:bg-teal-950/30',
    dotColor: 'bg-teal-500',
  },
  auzef_tr: {
    icon: <Building2 className="size-5" strokeWidth={1.75} />,
    label: 'AUZEF',
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    iconColor: 'text-amber-600 dark:text-amber-400',
    activeBorder: 'border-amber-400 dark:border-amber-600',
    activeBg: 'bg-amber-50 dark:bg-amber-950/30',
    dotColor: 'bg-amber-500',
  },
  auzef_istanbul: {
    icon: <Building2 className="size-5" strokeWidth={1.75} />,
    label: 'AUZEF İst.',
    iconBg: 'bg-orange-100 dark:bg-orange-900/30',
    iconColor: 'text-orange-600 dark:text-orange-400',
    activeBorder: 'border-orange-400 dark:border-orange-600',
    activeBg: 'bg-orange-50 dark:bg-orange-950/30',
    dotColor: 'bg-orange-500',
  },
  ata_aof: {
    icon: <Landmark className="size-5" strokeWidth={1.75} />,
    label: 'ATA AÖF',
    iconBg: 'bg-rose-100 dark:bg-rose-900/30',
    iconColor: 'text-rose-600 dark:text-rose-400',
    activeBorder: 'border-rose-400 dark:border-rose-600',
    activeBg: 'bg-rose-50 dark:bg-rose-950/30',
    dotColor: 'bg-rose-500',
  },
};

const DEFAULT_CAT_META: CatMeta = {
  icon: <ClipboardList className="size-5" strokeWidth={1.75} />,
  label: '',
  iconBg: 'bg-zinc-100 dark:bg-zinc-800',
  iconColor: 'text-zinc-600 dark:text-zinc-400',
  activeBorder: 'border-zinc-400 dark:border-zinc-600',
  activeBg: 'bg-zinc-50 dark:bg-zinc-900',
  dotColor: 'bg-zinc-500',
};

function getCatMeta(id: string): CatMeta {
  return CAT_META[id] ?? DEFAULT_CAT_META;
}

/* ─────────────────────────────────────────────────────── page */
export default function SinavGorevUcretleriPage() {
  const { token, me } = useAuth();
  const mods = (me as { moderator_modules?: string[] } | undefined)?.moderator_modules;
  const canManage = useMemo(
    () =>
      me?.role === 'superadmin' ||
      (me?.role === 'moderator' && Array.isArray(mods) && mods.includes('extra_lesson_params')),
    [me?.role, mods],
  );

  const [catalog, setCatalog] = useState<ExamDutyFeeCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  const [categoryId, setCategoryId] = useState('');
  const [roleKey, setRoleKey] = useState('');
  const [quantityStr, setQuantityStr] = useState('1');
  const quantity = useMemo(() => Math.max(1, Math.round(parseNum(quantityStr) || 1)), [quantityStr]);
  const [taxRate, setTaxRate] = useState(15);
  const [gvUsed, setGvUsed] = useState(0);
  const [dvUsed, setDvUsed] = useState(0);
  const [refOpen, setRefOpen] = useState(false);
  const catalogInitialized = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    try {
      const data = await apiFetch<ExamDutyFeeCatalog>('/app-config/exam-duty-fees/public', {
        signal: ctrl.signal,
      });
      setCatalog(data);
    } catch (e) {
      if (isAbortError(e)) return;
      toast.error(e instanceof Error ? e.message : 'Yüklenemedi');
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => { abortRef.current?.abort(); };
  }, [load]);

  // Default gvUsed / dvUsed to max on first load
  useEffect(() => {
    if (!catalog?.categories?.length) return;
    if (!catalogInitialized.current) {
      catalogInitialized.current = true;
      setGvUsed(catalog.gv_exemption_max_tl);
      setDvUsed(catalog.dv_exemption_max_tl);
    }
    const first = catalog.categories[0]!;
    if (!categoryId || !catalog.categories.some((c) => c.id === categoryId)) {
      setCategoryId(first.id);
      setRoleKey(first.roles[0]?.key ?? '');
      return;
    }
    const sel = catalog.categories.find((c) => c.id === categoryId);
    if (sel && !sel.roles.some((r) => r.key === roleKey)) {
      setRoleKey(sel.roles[0]?.key ?? '');
    }
  }, [catalog, categoryId, roleKey]);

  const selectedCategory = useMemo(
    () => catalog?.categories.find((c) => c.id === categoryId),
    [catalog, categoryId],
  );
  const selectedRole = useMemo(
    () => selectedCategory?.roles.find((r) => r.key === roleKey),
    [selectedCategory, roleKey],
  );

  const taxRateOptions = useMemo(() => {
    const from = catalog?.gv_brackets.map((b) => Math.round(b.rate_percent)) ?? [];
    return Array.from(new Set([...from, 15, 20, 27, 35, 40])).sort((a, b) => a - b);
  }, [catalog?.gv_brackets]);

  const result = useMemo(() => {
    const zero = {
      unitBrut: 0, totalBrut: 0, taxOnBrut: 0,
      gvExemptionUsed: 0, gvExemptionRemaining: 0, gvKesinti: 0,
      dvExemptionMatrahUsed: 0, dvExemptionMatrahRemaining: 0, dvKesinti: 0, net: 0,
    };
    if (!catalog) return zero;
    return computeExamDutyResult(catalog, selectedRole, { quantity, taxRate, gvUsed, dvUsed });
  }, [catalog, selectedRole, quantity, taxRate, gvUsed, dvUsed]);

  const hasSelection = Boolean(selectedRole && result.totalBrut > 0);

  const reset = useCallback(() => {
    if (!catalog?.categories?.length) return;
    const first = catalog.categories[0]!;
    setCategoryId(first.id);
    setRoleKey(first.roles[0]?.key ?? '');
    setQuantityStr('1');
    setTaxRate(15);
    setGvUsed(catalog.gv_exemption_max_tl);
    setDvUsed(catalog.dv_exemption_max_tl);
  }, [catalog]);

  const save = useCallback(async () => {
    if (!catalog || !token || !canManage) return;
    setSaving(true);
    try {
      await apiFetch<{ success: boolean }>('/app-config/exam-duty-fees', {
        method: 'PATCH',
        token,
        body: JSON.stringify(catalog),
      });
      toast.success('Kaydedildi');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kayıt başarısız');
    } finally {
      setSaving(false);
    }
  }, [catalog, token, canManage, load]);

  const updateMeta = (patch: Partial<ExamDutyFeeCatalog>) =>
    setCatalog((c) => (c ? { ...c, ...patch } : c));

  const updateBracket = (i: number, field: 'max_matrah' | 'rate_percent', value: string) =>
    setCatalog((c) => {
      if (!c) return c;
      return {
        ...c,
        gv_brackets: c.gv_brackets.map((b, idx) => (idx === i ? { ...b, [field]: parseNum(value) } : b)),
      };
    });

  const updateRole = (catIdx: number, rowIdx: number, patch: Partial<ExamDutyFeeRoleRow>) =>
    setCatalog((c) => {
      if (!c) return c;
      return {
        ...c,
        categories: c.categories.map((cat, ci) =>
          ci !== catIdx
            ? cat
            : { ...cat, roles: cat.roles.map((row, ri) => (ri === rowIdx ? { ...row, ...patch } : row)) },
        ),
      };
    });

  const addRole = (catIdx: number) =>
    setCatalog((c) => {
      if (!c) return c;
      return {
        ...c,
        categories: c.categories.map((cat, ci) =>
          ci !== catIdx
            ? cat
            : { ...cat, roles: [...cat.roles, { key: `yeni_${Date.now()}`, label: 'Yeni görev', brut_tl: 0 }] },
        ),
      };
    });

  const removeRole = (catIdx: number, rowIdx: number) =>
    setCatalog((c) => {
      if (!c) return c;
      return {
        ...c,
        categories: c.categories.map((cat, ci) =>
          ci !== catIdx ? cat : { ...cat, roles: cat.roles.filter((_, ri) => ri !== rowIdx) },
        ),
      };
    });

  const buildShareText = useCallback(() => {
    if (!catalog || !selectedRole || !selectedCategory) return '';
    return [
      '══════════════════════════════',
      '  SINAV GÖREV ÜCRETİ',
      '══════════════════════════════',
      '',
      `Dönem: ${catalog.period_label}`,
      `Kurum: ${selectedCategory.label}`,
      `Görev: ${selectedRole.label}`,
      `Adet: ${quantity}`,
      `GV dilimi: %${taxRate}`,
      '',
      '──────────────────────────────',
      `  Brüt:  ${formatTL(result.totalBrut)}`,
      `  GV:    -${formatTL(result.gvKesinti)}`,
      `  DV:    -${formatTL(result.dvKesinti)}`,
      `  Net:   ${formatTL(result.net)}`,
    ].join('\n');
  }, [catalog, selectedCategory, selectedRole, quantity, taxRate, result]);

  const handleShare = useCallback(async () => {
    const text = buildShareText();
    if (!text) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: 'Sınav görev ücreti', text });
        toast.success('Paylaşıldı');
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        toast.success('Panoya kopyalandı');
      } else {
        toast.error('Paylaşım desteklenmiyor');
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      toast.error((e as Error).message || 'Paylaşılamadı');
    }
  }, [buildShareText]);

  const inputCls =
    'w-full min-h-[44px] rounded-xl border border-zinc-200 bg-white px-3.5 py-3 text-base transition-all placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500 sm:py-2.5 sm:text-sm';
  const labelCls =
    'mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-medium leading-snug text-zinc-500 dark:text-zinc-400';

  return (
    <div className="relative min-h-screen bg-linear-to-br from-sky-50/40 via-violet-50/20 to-amber-50/30 dark:from-zinc-950 dark:via-violet-950/10 dark:to-zinc-950">
      <div
        className="mx-auto max-w-6xl px-4 py-6 pb-8 sm:px-6 sm:py-8 sm:pb-12 lg:px-8"
        style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
      >
        {/* ── header ── */}
        <header className="mb-8 flex flex-col gap-4 border-b border-zinc-200/80 pb-6 dark:border-zinc-800/80">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/hesaplamalar"
                  className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:border-violet-200 hover:text-violet-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-violet-900 dark:hover:text-violet-300"
                >
                  <ArrowLeft className="size-3.5" />
                  Hesaplamalar
                </Link>
                {catalog ? (
                  <span className="inline-flex items-center rounded-full bg-violet-100 px-3 py-1.5 text-xs font-medium text-violet-800 dark:bg-violet-900/40 dark:text-violet-200">
                    {catalog.period_label}
                  </span>
                ) : null}
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
                Sınav görev ücreti
              </h1>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2 lg:flex-col lg:items-stretch">
              {hasSelection ? (
                <button
                  type="button"
                  onClick={() => void handleShare()}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-violet-300 bg-violet-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-violet-600 active:scale-[0.98] dark:border-violet-600 dark:bg-violet-600"
                >
                  <Share2 className="size-4" strokeWidth={2} />
                  Paylaş
                </button>
              ) : null}
              <button
                type="button"
                onClick={reset}
                className="group inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-2.5 text-sm font-medium text-amber-800 transition-all hover:bg-amber-100 active:scale-[0.98] dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
              >
                <RotateCcw className="size-4 text-amber-600 transition-transform group-hover:-rotate-180 group-hover:duration-500 dark:text-amber-400" strokeWidth={2} />
                Sıfırla
              </button>
              {canManage ? (
                <button
                  type="button"
                  onClick={() => setAdminOpen((o) => !o)}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                >
                  <Settings className="size-4" />
                  {adminOpen ? 'Ayarları gizle' : 'Ayarları düzenle'}
                </button>
              ) : null}
            </div>
          </div>
        </header>

        {loading && !catalog ? <CalcSkeleton /> : null}

        {!loading && !catalog ? (
          <div className="rounded-2xl border border-amber-200/70 bg-amber-50/50 p-8 text-center text-sm text-zinc-600 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-zinc-400">
            Veri yüklenemedi.
            <div className="mt-4">
              <Button type="button" variant="outline" onClick={() => void load()}>
                Yeniden dene
              </Button>
            </div>
          </div>
        ) : null}

        {catalog ? (
          <div className="flex min-w-0 flex-col gap-6 lg:grid lg:grid-cols-[1fr_360px]">
            {/* ── left column ── */}
            <div className="min-w-0 space-y-6 lg:order-1">

              {/* ── 1. Institution cards ── */}
              <section className="relative overflow-hidden rounded-2xl border border-violet-200/60 bg-white p-5 shadow-sm dark:border-violet-900/50 dark:bg-zinc-900">
                <div className="absolute left-0 top-0 h-full w-1.5 rounded-l-2xl bg-linear-to-b from-violet-500 via-fuchsia-500 to-amber-500" />
                <DotPattern />
                <div className="relative space-y-5">
                  <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                    Kurum seç
                  </p>
                  {/* institution cards */}
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
                    {catalog.categories.map((cat) => {
                      const meta = getCatMeta(cat.id);
                      const selected = cat.id === categoryId;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            setCategoryId(cat.id);
                            setRoleKey(cat.roles[0]?.key ?? '');
                          }}
                          className={cn(
                            'relative flex flex-col gap-3 rounded-2xl border p-3.5 text-left transition-all active:scale-[0.97] sm:p-4',
                            selected
                              ? cn('shadow-sm ring-2 ring-offset-0 ring-zinc-100/50 dark:ring-zinc-900/50', meta.activeBorder, meta.activeBg)
                              : 'border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700',
                          )}
                        >
                          {/* selected dot */}
                          {selected ? (
                            <span className={cn('absolute right-3 top-3 size-2 rounded-full', meta.dotColor)} />
                          ) : null}
                          {/* icon */}
                          <span className={cn('flex size-9 items-center justify-center rounded-xl', meta.iconBg)}>
                            <span className={meta.iconColor}>{meta.icon}</span>
                          </span>
                          {/* text */}
                          <div className="min-w-0">
                            <p className={cn('truncate text-sm font-semibold leading-snug', selected ? 'text-zinc-900 dark:text-zinc-50' : 'text-zinc-800 dark:text-zinc-200')}>
                              {meta.label || cat.label}
                            </p>
                            <p className="mt-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">
                              {cat.roles.length} görev
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* role + quantity */}
                  {selectedCategory ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <p className="mb-1.5 text-[11px] font-medium text-zinc-500">
                          {selectedCategory.description}
                        </p>
                      </div>
                      <div className="sm:col-span-2">
                        <label className={labelCls}>Görev türü</label>
                        <select
                          value={roleKey}
                          onChange={(e) => setRoleKey(e.target.value)}
                          className={inputCls}
                        >
                          <option value="">Seçin…</option>
                          {selectedCategory.roles.map((role) => (
                            <option key={role.key} value={role.key}>
                              {role.label} — {formatTL(role.brut_tl)} brüt
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Oturum / adet</label>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          step={1}
                          value={quantityStr}
                          onChange={(e) => setQuantityStr(e.target.value)}
                          onBlur={() => setQuantityStr(String(quantity))}
                          className={inputCls}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              </section>

              {/* ── 2. Vergi ve istisnalar ── */}
              <section className="relative overflow-hidden rounded-2xl border border-emerald-200/60 bg-white p-5 shadow-sm dark:border-emerald-900/50 dark:bg-zinc-900">
                <div className="absolute left-0 top-0 h-full w-1.5 rounded-l-2xl bg-linear-to-b from-emerald-500 via-teal-500 to-cyan-500" />
                <DotPattern />
                <div className="relative space-y-5">
                  <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                    Dilim ve istisnalar
                  </p>

                  {/* GV dilimi — pill buttons */}
                  <div>
                    <p className={labelCls}>GV dilimi</p>
                    <div className="flex flex-wrap gap-2">
                      {taxRateOptions.map((rate) => (
                        <button
                          key={rate}
                          type="button"
                          onClick={() => setTaxRate(rate)}
                          className={cn(
                            'rounded-full px-4 py-2 text-sm font-medium transition-all active:scale-[0.97]',
                            taxRate === rate
                              ? 'bg-emerald-500 text-white shadow-sm dark:bg-emerald-600'
                              : 'border border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700',
                          )}
                        >
                          %{rate}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {/* GV istisna */}
                    <div>
                      <label className={labelCls}>
                        Maaşta kullanılan GV istisnası
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                          max {formatTL(catalog.gv_exemption_max_tl)}
                        </span>
                      </label>
                      <div className="relative">
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          max={catalog.gv_exemption_max_tl}
                          value={gvUsed}
                          onChange={(e) => setGvUsed(Math.min(parseNum(e.target.value), catalog.gv_exemption_max_tl))}
                        />
                        {gvUsed >= catalog.gv_exemption_max_tl ? (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                            tam
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* DV istisna matrahı */}
                    <div>
                      <label className={labelCls}>
                        Maaşta kullanılan DV istisna matrahı
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                          max {formatTL(catalog.dv_exemption_max_tl)}
                        </span>
                      </label>
                      <div className="relative">
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          max={catalog.dv_exemption_max_tl}
                          value={dvUsed}
                          onChange={(e) => setDvUsed(Math.min(parseNum(e.target.value), catalog.dv_exemption_max_tl))}
                        />
                        {dvUsed >= catalog.dv_exemption_max_tl ? (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                            tam
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* DV oranı — read-only info */}
                    <div className="sm:col-span-2">
                      <div className="flex items-center gap-2 rounded-xl border border-zinc-200/70 bg-zinc-50/80 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-800/40">
                        <Info className="size-4 shrink-0 text-zinc-400" />
                        <span className="text-zinc-500 dark:text-zinc-400">
                          Damga vergisi oranı:
                        </span>
                        <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                          ‰{catalog.stamp_duty_rate_binde}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* ── 3. Vergi referansı — collapsible ── */}
              <section className="overflow-hidden rounded-2xl border border-sky-200/70 bg-white shadow-sm dark:border-sky-900/40 dark:bg-zinc-900">
                <button
                  type="button"
                  onClick={() => setRefOpen((o) => !o)}
                  className="flex min-h-[52px] w-full touch-manipulation items-center justify-between px-5 py-4 text-left transition-colors hover:bg-sky-50/50 dark:hover:bg-sky-950/20"
                >
                  <span className="flex items-center gap-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-sky-100 dark:bg-sky-900/30">
                      <Info className="size-4 text-sky-600 dark:text-sky-400" strokeWidth={2} />
                    </span>
                    Vergi referansı
                  </span>
                  <span className="flex size-8 items-center justify-center rounded-lg text-zinc-500">
                    {refOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                  </span>
                </button>
                {refOpen ? (
                  <div className="border-t border-sky-200/50 p-5 dark:border-sky-900/30">
                    <div className="grid gap-4 md:grid-cols-2">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">GV tarifeleri (2026)</CardTitle>
                        </CardHeader>
                        <CardContent className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Matraha kadar</TableHead>
                                <TableHead>Oran</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {catalog.gv_brackets.map((b, i) => (
                                <TableRow key={i}>
                                  <TableCell>{b.max_matrah.toLocaleString('tr-TR')} ₺</TableCell>
                                  <TableCell>%{b.rate_percent}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">İstisna tavanları</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                          <div className="flex items-center justify-between gap-3 rounded-lg bg-zinc-50 px-3 py-2.5 dark:bg-zinc-800/50">
                            <span className="text-zinc-600 dark:text-zinc-400">GV istisnası</span>
                            <strong className="tabular-nums">{formatTL(catalog.gv_exemption_max_tl)}</strong>
                          </div>
                          <div className="flex items-center justify-between gap-3 rounded-lg bg-zinc-50 px-3 py-2.5 dark:bg-zinc-800/50">
                            <span className="text-zinc-600 dark:text-zinc-400">DV istisna matrahı</span>
                            <strong className="tabular-nums">{formatTL(catalog.dv_exemption_max_tl)}</strong>
                          </div>
                          <p className="text-[11px] leading-snug text-zinc-400">
                            {catalog.gv_note}
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                ) : null}
              </section>

              {/* ── 4. Admin settings ── */}
              {canManage && adminOpen ? (
                <div className="space-y-6 border-t border-zinc-200 pt-8 dark:border-zinc-800">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Superadmin — Tablo yönetimi</h2>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => void load()} disabled={saving}>
                        Yeniden yükle
                      </Button>
                      <Button onClick={() => void save()} disabled={saving}>
                        <Save className="mr-2 size-4" />
                        {saving ? 'Kaydediliyor…' : 'Kaydet'}
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm">Dönem etiketi</CardTitle></CardHeader>
                      <CardContent>
                        <Input value={catalog.period_label} onChange={(e) => updateMeta({ period_label: e.target.value })} />
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm">Sürüm</CardTitle></CardHeader>
                      <CardContent>
                        <Input value={catalog.version} onChange={(e) => updateMeta({ version: e.target.value })} />
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm">GV istisna tavanı (₺)</CardTitle></CardHeader>
                      <CardContent>
                        <Input type="number" step="0.01" value={catalog.gv_exemption_max_tl}
                          onChange={(e) => updateMeta({ gv_exemption_max_tl: parseNum(e.target.value) })} />
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm">DV istisna matrahı (₺)</CardTitle></CardHeader>
                      <CardContent>
                        <Input type="number" step="0.01" value={catalog.dv_exemption_max_tl}
                          onChange={(e) => updateMeta({ dv_exemption_max_tl: parseNum(e.target.value) })} />
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm">DV oranı (‰)</CardTitle></CardHeader>
                      <CardContent>
                        <Input type="number" step="0.01" value={catalog.stamp_duty_rate_binde}
                          onChange={(e) => updateMeta({ stamp_duty_rate_binde: parseNum(e.target.value) })} />
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Kaynak notu</CardTitle></CardHeader>
                    <CardContent>
                      <textarea value={catalog.source_note} onChange={(e) => updateMeta({ source_note: e.target.value })} rows={4}
                        className="flex min-h-24 w-full resize-y rounded-lg border border-input bg-background px-4 py-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">GV notu</CardTitle></CardHeader>
                    <CardContent>
                      <textarea value={catalog.gv_note} onChange={(e) => updateMeta({ gv_note: e.target.value })} rows={3}
                        className="flex min-h-20 w-full resize-y rounded-lg border border-input bg-background px-4 py-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">GV dilimleri</CardTitle>
                      <CardDescription>Matrah üst sınırı ve oran</CardDescription>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Matraha kadar (₺)</TableHead>
                            <TableHead>Oran (%)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {catalog.gv_brackets.map((b, i) => (
                            <TableRow key={i}>
                              <TableCell>
                                <Input type="number" value={b.max_matrah}
                                  onChange={(e) => updateBracket(i, 'max_matrah', e.target.value)} />
                              </TableCell>
                              <TableCell>
                                <Input type="number" step="0.01" value={b.rate_percent}
                                  onChange={(e) => updateBracket(i, 'rate_percent', e.target.value)} />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  {catalog.categories.map((cat, catIdx) => (
                    <Card key={cat.id}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">{cat.label}</CardTitle>
                        {cat.description ? <CardDescription>{cat.description}</CardDescription> : null}
                      </CardHeader>
                      <CardContent className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Görev</TableHead>
                              <TableHead>Brüt (₺)</TableHead>
                              <TableHead className="w-14" />
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {cat.roles.map((row, rowIdx) => (
                              <TableRow key={`${row.key}-${rowIdx}`}>
                                <TableCell>
                                  <Input value={row.label}
                                    onChange={(e) => updateRole(catIdx, rowIdx, { label: e.target.value })} />
                                </TableCell>
                                <TableCell>
                                  <Input type="number" step="0.01" value={row.brut_tl}
                                    onChange={(e) => updateRole(catIdx, rowIdx, { brut_tl: parseNum(e.target.value) })} />
                                </TableCell>
                                <TableCell>
                                  <Button type="button" variant="ghost" size="icon" className="text-destructive"
                                    onClick={() => removeRole(catIdx, rowIdx)}>
                                    <Trash2 className="size-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => addRole(catIdx)}>
                          <Plus className="mr-2 size-4" />
                          Satır ekle
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : null}
            </div>

            {/* ── right aside — result ── */}
            <aside className="order-2 lg:sticky lg:top-6 lg:self-start" role="region" aria-live="polite" aria-label="Hesaplama sonucu">
              <div className="relative overflow-hidden rounded-t-3xl border border-b-0 border-violet-200/80 bg-white shadow-[0_-8px_32px_-8px_rgba(0,0,0,0.1)] dark:border-violet-900/50 dark:bg-zinc-900 lg:rounded-2xl lg:border-b lg:shadow-lg">
                <div className="absolute inset-0 bg-linear-to-br from-violet-500/10 via-fuchsia-500/5 to-amber-500/5" />
                <DotPattern />
                <div className="relative p-6 pb-8 sm:pb-6" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
                  {/* drag handle */}
                  <div className="mb-5 flex justify-center lg:hidden">
                    <span className="h-1 w-12 rounded-full bg-violet-300/60 dark:bg-violet-600/50" />
                  </div>

                  <h2 className="mb-5 flex items-center gap-2.5 text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-violet-500/10 dark:bg-violet-500/20">
                      <Receipt className="size-4 text-violet-600 dark:text-violet-400" strokeWidth={2} />
                    </span>
                    Sonuç
                  </h2>

                  {!hasSelection ? (
                    <div className="flex flex-col items-center py-14 text-center">
                      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800">
                        <Calculator className="size-7 text-zinc-400 dark:text-zinc-500" strokeWidth={1.5} />
                      </div>
                      <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                        Kurum ve görev seçin.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* net hero */}
                      <div className="mb-6 rounded-2xl bg-linear-to-br from-violet-500 via-fuchsia-600 to-amber-600 p-6 text-white shadow-lg shadow-violet-500/20">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-violet-100/80">
                          Tahmini net tutar
                        </p>
                        <p className="mt-2.5 text-4xl font-bold tabular-nums">
                          {formatTL(result.net)}
                        </p>
                        <p className="mt-2 text-[11px] text-violet-100/70">
                          GV %{taxRate} · ‰{catalog.stamp_duty_rate_binde} DV
                          {quantity > 1 ? ` · ${quantity} oturum` : ''}
                        </p>
                      </div>

                      {/* breakdown */}
                      <dl className="space-y-2 text-sm">
                        <div className="flex justify-between rounded-lg bg-zinc-50 px-3 py-2.5 dark:bg-zinc-800/50">
                          <dt className="text-zinc-500 dark:text-zinc-400">Birim brüt</dt>
                          <dd className="font-semibold tabular-nums">{formatTL(result.unitBrut)}</dd>
                        </div>
                        {quantity > 1 ? (
                          <div className="flex justify-between rounded-lg bg-zinc-50 px-3 py-2.5 dark:bg-zinc-800/50">
                            <dt className="text-zinc-500 dark:text-zinc-400">Brüt toplam ({quantity}×)</dt>
                            <dd className="font-semibold tabular-nums">{formatTL(result.totalBrut)}</dd>
                          </div>
                        ) : null}
                        <div className="flex justify-between rounded-lg bg-red-50 px-3 py-2.5 dark:bg-red-950/30">
                          <dt className="text-red-600 dark:text-red-400">GV kesintisi</dt>
                          <dd className="tabular-nums text-red-600 dark:text-red-400">
                            -{formatTL(result.gvKesinti)}
                          </dd>
                        </div>
                        <div className="flex justify-between rounded-lg bg-red-50 px-3 py-2.5 dark:bg-red-950/30">
                          <dt className="text-red-600 dark:text-red-400">DV kesintisi</dt>
                          <dd className="tabular-nums text-red-600 dark:text-red-400">
                            -{formatTL(result.dvKesinti)}
                          </dd>
                        </div>
                      </dl>

                      {/* detail box */}
                      <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-800/30">
                        <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
                          Detay
                        </p>
                        <dl className="space-y-2 text-xs">
                          {result.taxOnBrut > 0 ? (
                            <div className="flex justify-between gap-2">
                              <dt className="text-zinc-500 dark:text-zinc-400">GV hesaplanan</dt>
                              <dd className="tabular-nums font-medium">{formatTL(result.taxOnBrut)}</dd>
                            </div>
                          ) : null}
                          {result.gvExemptionUsed > 0 ? (
                            <div className="flex justify-between gap-2">
                              <dt className="text-zinc-500 dark:text-zinc-400">GV istisnası (bu görevde)</dt>
                              <dd className="tabular-nums font-medium">{formatTL(result.gvExemptionUsed)}</dd>
                            </div>
                          ) : null}
                          {result.gvExemptionRemaining > 0 ? (
                            <div className="flex justify-between gap-2">
                              <dt className="text-zinc-500 dark:text-zinc-400">GV istisnası (kalan)</dt>
                              <dd className="tabular-nums font-medium">{formatTL(result.gvExemptionRemaining)}</dd>
                            </div>
                          ) : null}
                          {result.dvExemptionMatrahUsed > 0 ? (
                            <div className="flex justify-between gap-2">
                              <dt className="text-zinc-500 dark:text-zinc-400">DV istisna matrahı (bu görevde)</dt>
                              <dd className="tabular-nums font-medium">{formatTL(result.dvExemptionMatrahUsed)}</dd>
                            </div>
                          ) : null}
                          {result.dvExemptionMatrahRemaining > 0 ? (
                            <div className="flex justify-between gap-2">
                              <dt className="text-zinc-500 dark:text-zinc-400">DV istisna matrahı (kalan)</dt>
                              <dd className="tabular-nums font-medium">{formatTL(result.dvExemptionMatrahRemaining)}</dd>
                            </div>
                          ) : null}
                        </dl>
                      </div>
                    </>
                  )}

                  <p className="mt-4 text-[10px] leading-relaxed text-zinc-400 dark:text-zinc-500">
                    Tahmindir. Maaş kümülatif matrahı ve kurum uygulamasına göre farklılık olabilir.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        ) : null}

        {/* admin save bar */}
        {canManage && adminOpen && catalog ? (
          <div className="fixed bottom-0 left-0 right-0 z-10 border-t bg-background/95 p-4 backdrop-blur supports-backdrop-filter:bg-background/80 md:pl-(--sidebar-width,0px)">
            <div className="mx-auto flex max-w-4xl justify-end gap-2">
              <Button variant="outline" onClick={() => void load()} disabled={saving}>
                Yeniden yükle
              </Button>
              <Button onClick={() => void save()} disabled={saving}>
                <Save className="mr-2 size-4" />
                {saving ? 'Kaydediliyor…' : 'Kaydet'}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
