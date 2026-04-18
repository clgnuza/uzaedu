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
import { captureResultCardAsPng } from '@/lib/capture-result-card-png';
import { ShareCardPngFiligran } from '@/components/share/share-card-png-filigran';
import { MobileShareSheetGlass } from '@/components/share/mobile-share-sheet-glass';
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
  Copy,
  Image as ImageIcon,
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
function DotPattern({ excludeFromScreenshot }: { excludeFromScreenshot?: boolean }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
      {...(excludeFromScreenshot ? { 'data-html2canvas-ignore': '' } : {})}
    >
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
    <div className="flex min-w-0 flex-col gap-4 sm:gap-6 lg:grid lg:grid-cols-[1fr_360px]">
      <div className="min-w-0 space-y-4 sm:space-y-6">
        <Skeleton className="h-48 rounded-xl sm:h-56 sm:rounded-2xl" />
        <Skeleton className="h-56 rounded-xl sm:h-64 sm:rounded-2xl" />
      </div>
      <Skeleton className="h-72 rounded-t-2xl sm:h-80 sm:rounded-2xl lg:sticky lg:top-6 lg:self-start" />
    </div>
  );
}

/* ─────────────────────────────────────────── institution meta */
type CatMeta = {
  icon: React.ReactNode;
  label: string;
  /** ikon kutusu — gradient */
  iconBg: string;
  iconColor: string;
  /** seçili değilken kart */
  idleBg: string;
  idleBorder: string;
  activeBorder: string;
  activeBg: string;
  activeRing: string;
  dotColor: string;
};

const CAT_META: Record<string, CatMeta> = {
  meb_klasik: {
    icon: <School className="size-5" strokeWidth={1.75} />,
    label: 'MEB Ortak & AÖL',
    iconBg:
      'bg-linear-to-br from-sky-400 via-blue-500 to-indigo-600 shadow-lg shadow-sky-500/35 ring-2 ring-white/40 dark:from-sky-500 dark:via-blue-600 dark:to-indigo-700 dark:ring-white/15',
    iconColor: 'text-white drop-shadow-sm',
    idleBg: 'bg-linear-to-br from-sky-50 to-blue-50/90 dark:from-sky-950/50 dark:to-blue-950/35',
    idleBorder: 'border-sky-200/90 dark:border-sky-600/35',
    activeBorder: 'border-sky-500 dark:border-sky-400',
    activeBg: 'bg-linear-to-br from-sky-100 via-blue-50 to-cyan-50 dark:from-sky-900/55 dark:via-blue-950/45 dark:to-indigo-950/30',
    activeRing: 'ring-sky-400/55 dark:ring-sky-500/45',
    dotColor: 'bg-sky-500',
  },
  meb_esinav: {
    icon: <Monitor className="size-5" strokeWidth={1.75} />,
    label: 'MEB e-Sınav',
    iconBg:
      'bg-linear-to-br from-indigo-400 via-violet-500 to-purple-700 shadow-lg shadow-indigo-500/35 ring-2 ring-white/40 dark:from-indigo-500 dark:via-violet-600 dark:to-purple-800 dark:ring-white/15',
    iconColor: 'text-white drop-shadow-sm',
    idleBg: 'bg-linear-to-br from-indigo-50 to-violet-50/90 dark:from-indigo-950/45 dark:to-violet-950/35',
    idleBorder: 'border-indigo-200/90 dark:border-indigo-600/35',
    activeBorder: 'border-indigo-500 dark:border-indigo-400',
    activeBg: 'bg-linear-to-br from-indigo-100 via-violet-50 to-purple-50 dark:from-indigo-900/50 dark:via-violet-950/40 dark:to-purple-950/30',
    activeRing: 'ring-indigo-400/55 dark:ring-indigo-500/45',
    dotColor: 'bg-indigo-500',
  },
  osym: {
    icon: <ClipboardList className="size-5" strokeWidth={1.75} />,
    label: 'ÖSYM',
    iconBg:
      'bg-linear-to-br from-violet-500 via-fuchsia-500 to-pink-600 shadow-lg shadow-violet-500/40 ring-2 ring-white/40 dark:from-violet-600 dark:via-fuchsia-600 dark:to-pink-700 dark:ring-white/15',
    iconColor: 'text-white drop-shadow-sm',
    idleBg: 'bg-linear-to-br from-violet-50 to-fuchsia-50/90 dark:from-violet-950/45 dark:to-fuchsia-950/35',
    idleBorder: 'border-violet-200/90 dark:border-violet-600/35',
    activeBorder: 'border-violet-500 dark:border-fuchsia-400',
    activeBg: 'bg-linear-to-br from-violet-100 via-fuchsia-50 to-pink-50 dark:from-violet-900/50 dark:via-fuchsia-950/40 dark:to-pink-950/25',
    activeRing: 'ring-fuchsia-400/55 dark:ring-fuchsia-500/45',
    dotColor: 'bg-fuchsia-500',
  },
  anadolu_aof_tr: {
    icon: <GraduationCap className="size-5" strokeWidth={1.75} />,
    label: 'Anadolu AÖF',
    iconBg:
      'bg-linear-to-br from-emerald-400 via-teal-500 to-cyan-600 shadow-lg shadow-emerald-500/35 ring-2 ring-white/40 dark:from-emerald-500 dark:via-teal-600 dark:to-cyan-700 dark:ring-white/15',
    iconColor: 'text-white drop-shadow-sm',
    idleBg: 'bg-linear-to-br from-emerald-50 to-teal-50/90 dark:from-emerald-950/45 dark:to-teal-950/35',
    idleBorder: 'border-emerald-200/90 dark:border-emerald-600/35',
    activeBorder: 'border-emerald-500 dark:border-teal-400',
    activeBg: 'bg-linear-to-br from-emerald-100 via-teal-50 to-cyan-50 dark:from-emerald-900/50 dark:via-teal-950/40 dark:to-cyan-950/25',
    activeRing: 'ring-emerald-400/55 dark:ring-emerald-500/45',
    dotColor: 'bg-emerald-500',
  },
  anadolu_aof_istanbul: {
    icon: <GraduationCap className="size-5" strokeWidth={1.75} />,
    label: 'Anadolu AÖF İst.',
    iconBg:
      'bg-linear-to-br from-teal-400 via-cyan-500 to-blue-600 shadow-lg shadow-teal-500/35 ring-2 ring-white/40 dark:from-teal-500 dark:via-cyan-600 dark:to-blue-700 dark:ring-white/15',
    iconColor: 'text-white drop-shadow-sm',
    idleBg: 'bg-linear-to-br from-teal-50 to-cyan-50/90 dark:from-teal-950/45 dark:to-cyan-950/35',
    idleBorder: 'border-teal-200/90 dark:border-teal-600/35',
    activeBorder: 'border-teal-500 dark:border-cyan-400',
    activeBg: 'bg-linear-to-br from-teal-100 via-cyan-50 to-sky-50 dark:from-teal-900/50 dark:via-cyan-950/40 dark:to-sky-950/25',
    activeRing: 'ring-teal-400/55 dark:ring-cyan-500/45',
    dotColor: 'bg-teal-500',
  },
  auzef_tr: {
    icon: <Building2 className="size-5" strokeWidth={1.75} />,
    label: 'AUZEF',
    iconBg:
      'bg-linear-to-br from-amber-400 via-orange-500 to-amber-700 shadow-lg shadow-amber-500/40 ring-2 ring-white/40 dark:from-amber-500 dark:via-orange-600 dark:to-amber-800 dark:ring-white/15',
    iconColor: 'text-white drop-shadow-sm',
    idleBg: 'bg-linear-to-br from-amber-50 to-orange-50/90 dark:from-amber-950/45 dark:to-orange-950/35',
    idleBorder: 'border-amber-200/90 dark:border-amber-600/35',
    activeBorder: 'border-amber-500 dark:border-orange-400',
    activeBg: 'bg-linear-to-br from-amber-100 via-orange-50 to-yellow-50 dark:from-amber-900/50 dark:via-orange-950/40 dark:to-yellow-950/20',
    activeRing: 'ring-amber-400/60 dark:ring-amber-500/45',
    dotColor: 'bg-amber-500',
  },
  auzef_istanbul: {
    icon: <Building2 className="size-5" strokeWidth={1.75} />,
    label: 'AUZEF İst.',
    iconBg:
      'bg-linear-to-br from-orange-400 via-red-500 to-rose-600 shadow-lg shadow-orange-500/40 ring-2 ring-white/40 dark:from-orange-500 dark:via-red-600 dark:to-rose-700 dark:ring-white/15',
    iconColor: 'text-white drop-shadow-sm',
    idleBg: 'bg-linear-to-br from-orange-50 to-rose-50/90 dark:from-orange-950/45 dark:to-rose-950/35',
    idleBorder: 'border-orange-200/90 dark:border-orange-600/35',
    activeBorder: 'border-orange-500 dark:border-rose-400',
    activeBg: 'bg-linear-to-br from-orange-100 via-rose-50 to-red-50 dark:from-orange-900/50 dark:via-rose-950/40 dark:to-red-950/25',
    activeRing: 'ring-orange-400/55 dark:ring-rose-500/45',
    dotColor: 'bg-orange-500',
  },
  ata_aof: {
    icon: <Landmark className="size-5" strokeWidth={1.75} />,
    label: 'ATA AÖF',
    iconBg:
      'bg-linear-to-br from-rose-400 via-pink-500 to-fuchsia-600 shadow-lg shadow-rose-500/40 ring-2 ring-white/40 dark:from-rose-500 dark:via-pink-600 dark:to-fuchsia-700 dark:ring-white/15',
    iconColor: 'text-white drop-shadow-sm',
    idleBg: 'bg-linear-to-br from-rose-50 to-pink-50/90 dark:from-rose-950/45 dark:to-pink-950/35',
    idleBorder: 'border-rose-200/90 dark:border-rose-600/35',
    activeBorder: 'border-rose-500 dark:border-pink-400',
    activeBg: 'bg-linear-to-br from-rose-100 via-pink-50 to-fuchsia-50 dark:from-rose-900/50 dark:via-pink-950/40 dark:to-fuchsia-950/25',
    activeRing: 'ring-rose-400/55 dark:ring-pink-500/45',
    dotColor: 'bg-rose-500',
  },
};

const DEFAULT_CAT_META: CatMeta = {
  icon: <ClipboardList className="size-5" strokeWidth={1.75} />,
  label: '',
  iconBg: 'bg-linear-to-br from-zinc-400 to-zinc-600 shadow-md ring-2 ring-white/30 dark:from-zinc-600 dark:to-zinc-800',
  iconColor: 'text-white drop-shadow-sm',
  idleBg: 'bg-zinc-50 dark:bg-zinc-900/80',
  idleBorder: 'border-zinc-200 dark:border-zinc-700',
  activeBorder: 'border-zinc-500 dark:border-zinc-400',
  activeBg: 'bg-zinc-100 dark:bg-zinc-800/80',
  activeRing: 'ring-zinc-400/50',
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
    () => catalog?.categories?.find((c) => c.id === categoryId),
    [catalog, categoryId],
  );
  const selectedRole = useMemo(
    () => selectedCategory?.roles?.find((r) => r.key === roleKey),
    [selectedCategory, roleKey],
  );

  const taxRateOptions = useMemo(() => {
    const from = catalog?.gv_brackets?.map((b) => Math.round(b.rate_percent)) ?? [];
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
    const meta = getCatMeta(selectedCategory.id);
    const kurumAd = meta.label || selectedCategory.label;
    return [
      '══════════════════════════════',
      '  SINAV GÖREV ÜCRETİ',
      '══════════════════════════════',
      '',
      'GİRDİLER',
      `  Dönem: ${catalog.period_label}`,
      `  Kurum: ${kurumAd}`,
      `  Görev: ${selectedRole.label}`,
      `  Birim brüt: ${formatTL(selectedRole.brut_tl)}`,
      `  Oturum / adet: ${quantity}`,
      `  GV dilimi (kabaca): %${taxRate}`,
      `  GV istisna kullanılan: ${formatTL(gvUsed)} / ${formatTL(catalog.gv_exemption_max_tl)}`,
      `  DV istisna matrah kullanılan: ${formatTL(dvUsed)} / ${formatTL(catalog.dv_exemption_max_tl)}`,
      '',
      'ÖZET',
      `  Toplam brüt: ${formatTL(result.totalBrut)} (${quantity} × ${formatTL(result.unitBrut)})`,
      '',
      '──────────────────────────────',
      'SONUÇ',
      '──────────────────────────────',
      `  Net:   ${formatTL(result.net)}`,
      `  Brüt:  ${formatTL(result.totalBrut)}`,
      `  GV:    −${formatTL(result.gvKesinti)} (hesaplanan GV ${formatTL(result.taxOnBrut)})`,
      `  DV:    −${formatTL(result.dvKesinti)}`,
      '',
      'Bilgilendirme amaçlıdır. Kurum uygulamasına göre farklılık olabilir.',
    ].join('\n');
  }, [catalog, selectedCategory, selectedRole, quantity, taxRate, gvUsed, dvUsed, result]);

  /** Görsel + kısa metin (WhatsApp vb. için) */
  const buildShareShort = useCallback(() => {
    if (!catalog || !selectedRole || !selectedCategory) return '';
    const m = getCatMeta(selectedCategory.id);
    const kurum = m.label || selectedCategory.label;
    return [
      '📋 Sınav görev ücreti · Uzaedu Öğretmen',
      `📅 ${catalog.period_label}`,
      `🏛 ${kurum}`,
      `📝 ${selectedRole.label}`,
      '',
      `💶 Tahmini net: ${formatTL(result.net)}`,
      `📊 Brüt toplam: ${formatTL(result.totalBrut)}`,
    ].join('\n');
  }, [catalog, selectedCategory, selectedRole, result.net, result.totalBrut]);

  const resultCardRef = useRef<HTMLDivElement>(null);
  const shareSnapshotRef = useRef<HTMLDivElement>(null);

  /** Paylaşım kartı genişliği: mobil viewport’a göre (WhatsApp önizlemesi için) */
  const [shareExportWidth, setShareExportWidth] = useState(360);
  useEffect(() => {
    const ro = () => {
      if (typeof window === 'undefined') return;
      const w = Math.min(420, Math.max(304, window.innerWidth - 32));
      setShareExportWidth(w);
    };
    ro();
    window.addEventListener('resize', ro);
    return () => window.removeEventListener('resize', ro);
  }, []);

  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const [shareSheetMounted, setShareSheetMounted] = useState(false);
  const [sharePreviewUrl, setSharePreviewUrl] = useState<string | null>(null);
  useEffect(() => setShareSheetMounted(true), []);

  useEffect(() => {
    if (!shareSheetOpen || !hasSelection) {
      setSharePreviewUrl((u) => {
        if (u) URL.revokeObjectURL(u);
        return null;
      });
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      void (async () => {
        const blob = await captureResultCardAsPng(resultCardRef.current, shareSnapshotRef.current);
        if (cancelled || !blob) return;
        const url = URL.createObjectURL(blob);
        setSharePreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      })();
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [shareSheetOpen, hasSelection, result.net, result.totalBrut, result.gvKesinti, result.dvKesinti]);

  useEffect(() => {
    if (!shareSheetOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [shareSheetOpen]);

  const performShare = useCallback(async () => {
    const textFull = buildShareText();
    if (!textFull) return;
    const title = 'Sınav görev ücreti — Uzaedu Öğretmen';
    const short = buildShareShort();
    let blob: Blob | null = null;
    if (typeof window !== 'undefined') {
      blob = await captureResultCardAsPng(resultCardRef.current, shareSnapshotRef.current);
    }

    const tryCopyImage = async (): Promise<boolean> => {
      if (!blob || !navigator.clipboard?.write) return false;
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        toast.success('Sonuç kartı görseli panoya kopyalandı');
        return true;
      } catch {
        return false;
      }
    };

    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        if (blob) {
          const file = new File([blob], 'sinav-gorev-sonuc.png', { type: 'image/png' });
          const tryFilesText = { title, text: short, files: [file] } as ShareData;
          if (navigator.canShare?.(tryFilesText)) {
            await navigator.share(tryFilesText);
            toast.success('Sonuç kartı görseli ve özet paylaşıldı');
            return;
          }
          const tryFilesOnly = { title, files: [file] } as ShareData;
          if (navigator.canShare?.(tryFilesOnly)) {
            await navigator.share(tryFilesOnly);
            toast.success('Sonuç kartı görseli paylaşıldı');
            return;
          }
        }
        await navigator.share({ title, text: `${short}\n\n${textFull}` });
        toast.success(blob ? 'Metin paylaşıldı (görsel eklenemedi)' : 'Metin paylaşıldı');
        return;
      }
      if (blob && (await tryCopyImage())) return;
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${short}\n\n${textFull}`);
        toast.success(blob ? 'Metin panoya kopyalandı (görsel kopyalanamadı)' : 'Metin panoya kopyalandı');
      } else {
        toast.error('Paylaşım desteklenmiyor');
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      toast.error((e as Error).message || 'Paylaşılamadı');
    }
  }, [buildShareText, buildShareShort]);

  const copyShareText = useCallback(async () => {
    const textFull = buildShareText();
    if (!textFull) return;
    try {
      await navigator.clipboard.writeText(`${buildShareShort()}\n\n${textFull}`);
      toast.success('Metin kopyalandı');
      setShareSheetOpen(false);
    } catch {
      toast.error('Kopyalanamadı');
    }
  }, [buildShareText, buildShareShort]);

  const copyShareImageOnly = useCallback(async () => {
    const blob = await captureResultCardAsPng(resultCardRef.current, shareSnapshotRef.current);
    if (!blob) {
      toast.error('Sonuç kartı görseli oluşturulamadı');
      return;
    }
    try {
      if (navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        toast.success('Sonuç kartı görseli panoya kopyalandı');
        return;
      }
    } catch {
      /* continue */
    }
    toast.error('Tarayıcı görsel kopyalamayı desteklemiyor');
  }, []);

  const openMobileShareSheet = useCallback(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches) {
      setShareSheetOpen(true);
    } else {
      void performShare();
    }
  }, [performShare]);

  const inputCls =
    'w-full min-h-11 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm transition-all placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500 sm:min-h-[44px] sm:rounded-xl sm:px-3.5 sm:py-2.5';
  const labelCls =
    'mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-medium leading-snug text-zinc-500 sm:mb-1.5 sm:text-xs dark:text-zinc-400';

  return (
    <div className="relative min-h-screen bg-linear-to-br from-sky-50/40 via-violet-50/20 to-amber-50/30 dark:from-zinc-950 dark:via-violet-950/10 dark:to-zinc-950">
      <div
        className="mx-auto max-w-6xl px-3 py-2 pb-6 sm:px-6 sm:py-6 sm:pb-12 lg:px-8"
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        {/* ── header ── */}
        <header className="mb-4 flex flex-col gap-2.5 border-b border-zinc-200/80 pb-3 dark:border-zinc-800/80 sm:mb-7 sm:gap-4 sm:pb-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
            <div className="min-w-0 space-y-2 sm:space-y-3">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <Link
                  href="/hesaplamalar"
                  className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-600 transition hover:border-violet-200 hover:text-violet-700 sm:px-3 sm:py-1.5 sm:text-xs dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-violet-900 dark:hover:text-violet-300"
                >
                  <ArrowLeft className="size-3 sm:size-3.5" />
                  Hesaplamalar
                </Link>
                {catalog ? (
                  <span className="inline-flex max-w-full items-center truncate rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-medium text-violet-800 sm:px-3 sm:py-1.5 sm:text-xs dark:bg-violet-900/40 dark:text-violet-200">
                    {catalog.period_label}
                  </span>
                ) : null}
              </div>
              <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
                Sınav görev ücreti
              </h1>
            </div>
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:gap-2 lg:flex lg:flex-col lg:items-stretch">
              {hasSelection ? (
                <>
                  <button
                    type="button"
                    onClick={() => openMobileShareSheet()}
                    className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-violet-300 bg-violet-500 px-3 py-2 text-xs font-medium text-white shadow-sm transition-all hover:bg-violet-600 active:scale-[0.98] sm:min-h-[44px] sm:gap-2 sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-sm dark:border-violet-600 dark:bg-violet-600"
                  >
                    <Share2 className="size-3.5 sm:size-4" strokeWidth={2} />
                    Paylaş
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyShareImageOnly()}
                    className="hidden min-h-10 items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800 shadow-sm transition-all hover:bg-zinc-50 active:scale-[0.98] sm:inline-flex sm:min-h-[44px] sm:gap-2 sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700/80"
                    title="Sonuç kartının PNG görüntüsünü panoya kopyalar"
                  >
                    <ImageIcon className="size-3.5 sm:size-4" strokeWidth={2} />
                    Kart görseli
                  </button>
                </>
              ) : null}
              <button
                type="button"
                onClick={reset}
                className="group inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs font-medium text-amber-800 transition-all hover:bg-amber-100 active:scale-[0.98] sm:min-h-[44px] sm:gap-2 sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-sm dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
              >
                <RotateCcw className="size-3.5 text-amber-600 transition-transform group-hover:-rotate-180 group-hover:duration-500 sm:size-4 dark:text-amber-400" strokeWidth={2} />
                Sıfırla
              </button>
              {canManage ? (
                <button
                  type="button"
                  onClick={() => setAdminOpen((o) => !o)}
                  className="col-span-2 inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 sm:col-span-1 sm:min-h-[44px] sm:gap-2 sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 lg:col-span-1"
                >
                  <Settings className="size-3.5 sm:size-4" />
                  <span className="truncate">{adminOpen ? 'Ayarları gizle' : 'Ayarları düzenle'}</span>
                </button>
              ) : null}
            </div>
          </div>
        </header>

        {loading && !catalog ? <CalcSkeleton /> : null}

        {!loading && !catalog ? (
          <div className="rounded-xl border border-amber-200/70 bg-amber-50/50 p-5 text-center text-xs text-zinc-600 sm:rounded-2xl sm:p-8 sm:text-sm dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-zinc-400">
            Veri yüklenemedi.
            <div className="mt-4">
              <Button type="button" variant="outline" onClick={() => void load()}>
                Yeniden dene
              </Button>
            </div>
          </div>
        ) : null}

        {catalog ? (
          <div className="flex min-w-0 flex-col gap-4 sm:gap-6 lg:grid lg:grid-cols-[1fr_360px]">
            {/* ── left column ── */}
            <div className="min-w-0 space-y-4 sm:space-y-6 lg:order-1">

              {/* ── 1. Institution cards ── */}
              <section className="relative overflow-hidden rounded-xl border-2 border-violet-300/70 bg-white p-4 shadow-md ring-1 ring-violet-500/10 dark:border-violet-700/60 dark:bg-zinc-900 dark:ring-violet-500/20 sm:rounded-2xl sm:p-5">
                <div className="absolute left-0 top-0 h-full w-1.5 rounded-l-[10px] bg-linear-to-b from-violet-500 via-fuchsia-500 to-amber-500 sm:w-2 sm:rounded-l-2xl" />
                <DotPattern />
                <div className="relative space-y-4 sm:space-y-5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 sm:text-xs sm:tracking-widest dark:text-zinc-400">
                    Kurum seç
                  </p>
                  {/* institution cards */}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5 xl:grid-cols-4">
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
                            'relative flex flex-col gap-2 rounded-xl border-2 p-2.5 text-left transition-all active:scale-[0.98] sm:gap-3 sm:rounded-2xl sm:p-4',
                            selected
                              ? cn(
                                  'z-1 shadow-md ring-2 ring-offset-2 ring-offset-white dark:ring-offset-zinc-950',
                                  meta.activeRing,
                                  meta.activeBorder,
                                  meta.activeBg,
                                )
                              : cn(
                                  meta.idleBorder,
                                  meta.idleBg,
                                  'hover:shadow-md hover:brightness-[1.03] dark:hover:brightness-110',
                                ),
                          )}
                        >
                          {/* selected dot */}
                          {selected ? (
                            <span
                              className={cn(
                                'absolute right-2 top-2 size-2 rounded-full shadow-sm ring-2 ring-white dark:ring-zinc-900 sm:right-3 sm:top-3',
                                meta.dotColor,
                              )}
                            />
                          ) : null}
                          {/* icon */}
                          <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg sm:size-9 sm:rounded-xl', meta.iconBg)}>
                            <span className={cn(meta.iconColor, '[&_svg]:size-4 sm:[&_svg]:size-5')}>{meta.icon}</span>
                          </span>
                          {/* text */}
                          <div className="min-w-0 pr-1">
                            <p
                              className={cn(
                                'line-clamp-2 text-[11px] font-semibold leading-tight sm:line-clamp-none sm:truncate sm:text-sm sm:leading-snug',
                                selected ? 'text-zinc-900 dark:text-zinc-50' : 'text-zinc-800 dark:text-zinc-100',
                              )}
                            >
                              {meta.label || cat.label}
                            </p>
                            <p className="mt-0.5 text-[10px] text-zinc-500 sm:text-[11px] dark:text-zinc-400">
                              {cat.roles.length} görev
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* role + quantity */}
                  {selectedCategory ? (
                    <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2">
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
              <section className="relative overflow-hidden rounded-xl border-2 border-emerald-300/70 bg-white p-4 shadow-md ring-1 ring-emerald-500/10 dark:border-emerald-700/55 dark:bg-zinc-900 dark:ring-emerald-500/15 sm:rounded-2xl sm:p-5">
                <div className="absolute left-0 top-0 h-full w-1.5 rounded-l-[10px] bg-linear-to-b from-emerald-500 via-teal-500 to-cyan-500 sm:w-2 sm:rounded-l-2xl" />
                <DotPattern />
                <div className="relative space-y-4 sm:space-y-5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 sm:text-xs sm:tracking-widest dark:text-zinc-400">
                    Dilim ve istisnalar
                  </p>

                  {/* GV dilimi — pill buttons */}
                  <div>
                    <p className={labelCls}>GV dilimi</p>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      {taxRateOptions.map((rate) => (
                        <button
                          key={rate}
                          type="button"
                          onClick={() => setTaxRate(rate)}
                          className={cn(
                            'rounded-full px-3 py-1.5 text-xs font-medium transition-all active:scale-[0.97] sm:px-4 sm:py-2 sm:text-sm',
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

                  <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2">
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
                      <div className="flex flex-col gap-1 rounded-lg border border-zinc-200/70 bg-zinc-50/80 px-3 py-2.5 text-xs sm:flex-row sm:items-center sm:gap-2 sm:rounded-xl sm:px-4 sm:py-3 sm:text-sm dark:border-zinc-800 dark:bg-zinc-800/40">
                        <span className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                          <Info className="size-3.5 shrink-0 text-zinc-400 sm:size-4" />
                          Damga vergisi oranı
                        </span>
                        <span className="font-semibold tabular-nums text-zinc-700 dark:text-zinc-300 sm:ml-auto">
                          ‰{catalog.stamp_duty_rate_binde}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* ── 3. Vergi referansı — collapsible ── */}
              <section className="overflow-hidden rounded-xl border-2 border-sky-300/70 bg-white shadow-md ring-1 ring-sky-500/10 dark:border-sky-700/50 dark:bg-zinc-900 dark:ring-sky-500/15 sm:rounded-2xl">
                <button
                  type="button"
                  onClick={() => setRefOpen((o) => !o)}
                  className="flex min-h-12 w-full touch-manipulation items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-sky-50/50 sm:min-h-[52px] sm:px-5 sm:py-4 dark:hover:bg-sky-950/20"
                >
                  <span className="flex min-w-0 items-center gap-2.5 text-xs font-semibold text-zinc-800 sm:gap-3 sm:text-sm dark:text-zinc-200">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-sky-100 sm:size-8 dark:bg-sky-900/30">
                      <Info className="size-3.5 text-sky-600 sm:size-4 dark:text-sky-400" strokeWidth={2} />
                    </span>
                    <span className="truncate">Vergi referansı</span>
                  </span>
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg text-zinc-500 sm:size-8">
                    {refOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                  </span>
                </button>
                {refOpen ? (
                  <div className="border-t border-sky-200/50 p-4 dark:border-sky-900/30 sm:p-5">
                    <div className="grid gap-3 md:grid-cols-2 md:gap-4">
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
                <div className="space-y-4 border-t border-zinc-200 pt-6 dark:border-zinc-800 sm:space-y-6 sm:pt-8">
                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
                    <h2 className="text-sm font-semibold text-zinc-900 sm:text-base dark:text-zinc-50">Superadmin — Tablo yönetimi</h2>
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
              <div
                ref={resultCardRef}
                className="relative overflow-hidden rounded-t-2xl border-2 border-b-0 border-violet-300/80 bg-white shadow-[0_-8px_32px_-8px_rgba(79,70,229,0.18)] dark:border-violet-700/55 dark:bg-zinc-900 sm:rounded-t-3xl lg:rounded-2xl lg:border-b lg:border-violet-300/70 lg:shadow-xl"
              >
                <div
                  className="absolute inset-0 bg-linear-to-br from-violet-500/10 via-fuchsia-500/5 to-amber-500/5"
                  data-html2canvas-ignore
                />
                <DotPattern excludeFromScreenshot />
                <div className="relative p-4 pb-6 sm:p-6 sm:pb-6" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
                  {/* drag handle */}
                  <div className="mb-3 flex justify-center lg:hidden" data-html2canvas-ignore>
                    <span className="h-1 w-10 rounded-full bg-violet-300/60 dark:bg-violet-600/50" />
                  </div>

                  <h2 className="mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 sm:mb-5 sm:gap-2.5 sm:text-xs sm:tracking-widest dark:text-zinc-400">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-violet-500/10 sm:size-8 dark:bg-violet-500/20">
                      <Receipt className="size-3.5 text-violet-600 sm:size-4 dark:text-violet-400" strokeWidth={2} />
                    </span>
                    Sonuç
                  </h2>

                  {!hasSelection ? (
                    <div className="flex flex-col items-center py-10 text-center sm:py-14">
                      <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-zinc-100 sm:mb-4 sm:size-14 sm:rounded-2xl dark:bg-zinc-800">
                        <Calculator className="size-6 text-zinc-400 sm:size-7 dark:text-zinc-500" strokeWidth={1.5} />
                      </div>
                      <p className="max-w-[16rem] text-xs leading-relaxed text-zinc-500 sm:text-sm dark:text-zinc-400">
                        Kurum ve görev seçin.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* net hero */}
                      <div className="mb-4 rounded-xl bg-linear-to-br from-violet-500 via-fuchsia-600 to-amber-600 p-4 text-white shadow-lg shadow-violet-500/20 sm:mb-6 sm:rounded-2xl sm:p-6">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-violet-100/80 sm:text-[10px] sm:tracking-widest">
                          Tahmini net tutar
                        </p>
                        <p className="mt-2 text-3xl font-bold tabular-nums leading-none sm:mt-2.5 sm:text-4xl">
                          {formatTL(result.net)}
                        </p>
                        <p className="mt-2 text-[10px] leading-snug text-violet-100/80 sm:text-[11px]">
                          GV %{taxRate} · ‰{catalog.stamp_duty_rate_binde} DV
                          {quantity > 1 ? ` · ${quantity} oturum` : ''}
                        </p>
                      </div>

                      {selectedCategory && selectedRole ? (
                        <div className="mb-4 rounded-lg border border-violet-200/70 bg-violet-50/40 p-3 dark:border-violet-900/40 dark:bg-violet-950/25 sm:mb-5 sm:rounded-xl sm:p-4">
                          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-violet-800 sm:mb-2.5 sm:text-xs dark:text-violet-300">
                            Hesaplanan girdiler
                          </p>
                          <ul className="space-y-1 text-[11px] text-zinc-700 sm:space-y-1.5 sm:text-xs dark:text-zinc-300">
                            <li className="flex justify-between gap-2">
                              <span className="text-zinc-500 dark:text-zinc-400">Dönem</span>
                              <span className="min-w-0 text-right font-medium">{catalog.period_label}</span>
                            </li>
                            <li className="flex justify-between gap-2">
                              <span className="text-zinc-500 dark:text-zinc-400">Kurum</span>
                              <span className="min-w-0 text-right font-medium">
                                {getCatMeta(selectedCategory.id).label || selectedCategory.label}
                              </span>
                            </li>
                            <li className="flex justify-between gap-2">
                              <span className="text-zinc-500 dark:text-zinc-400">Görev</span>
                              <span className="min-w-0 text-right font-medium">{selectedRole.label}</span>
                            </li>
                            <li className="flex justify-between gap-2 border-t border-violet-200/50 pt-2 dark:border-violet-900/40">
                              <span className="text-zinc-500 dark:text-zinc-400">Birim brüt</span>
                              <span className="tabular-nums font-semibold text-zinc-900 dark:text-zinc-100">
                                {formatTL(result.unitBrut)}
                              </span>
                            </li>
                            <li className="flex justify-between gap-2">
                              <span className="text-zinc-500 dark:text-zinc-400">Oturum / adet</span>
                              <span className="tabular-nums font-semibold text-zinc-900 dark:text-zinc-100">{quantity}</span>
                            </li>
                            <li className="flex justify-between gap-2 font-semibold text-zinc-900 dark:text-zinc-100">
                              <span>Brüt toplam</span>
                              <span className="tabular-nums">
                                {formatTL(result.totalBrut)}
                                {quantity > 1 ? ` (${quantity}×)` : ''}
                              </span>
                            </li>
                          </ul>
                        </div>
                      ) : null}

                      {/* breakdown */}
                      <dl className="space-y-1.5 text-xs sm:space-y-2 sm:text-sm">
                        <div className="flex justify-between gap-2 rounded-lg bg-zinc-50 px-2.5 py-2 sm:px-3 sm:py-2.5 dark:bg-zinc-800/50">
                          <dt className="text-zinc-500 dark:text-zinc-400">Birim brüt</dt>
                          <dd className="shrink-0 font-semibold tabular-nums">{formatTL(result.unitBrut)}</dd>
                        </div>
                        {quantity > 1 ? (
                          <div className="flex justify-between gap-2 rounded-lg bg-zinc-50 px-2.5 py-2 sm:px-3 sm:py-2.5 dark:bg-zinc-800/50">
                            <dt className="text-zinc-500 dark:text-zinc-400">Brüt toplam ({quantity}×)</dt>
                            <dd className="shrink-0 font-semibold tabular-nums">{formatTL(result.totalBrut)}</dd>
                          </div>
                        ) : null}
                        <div className="flex justify-between gap-2 rounded-lg bg-red-50 px-2.5 py-2 sm:px-3 sm:py-2.5 dark:bg-red-950/30">
                          <dt className="text-red-600 dark:text-red-400">GV kesintisi</dt>
                          <dd className="shrink-0 tabular-nums text-red-600 dark:text-red-400">
                            -{formatTL(result.gvKesinti)}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2 rounded-lg bg-red-50 px-2.5 py-2 sm:px-3 sm:py-2.5 dark:bg-red-950/30">
                          <dt className="text-red-600 dark:text-red-400">DV kesintisi</dt>
                          <dd className="shrink-0 tabular-nums text-red-600 dark:text-red-400">
                            -{formatTL(result.dvKesinti)}
                          </dd>
                        </div>
                      </dl>

                      {/* detail box */}
                      <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-800/30 sm:mt-4 sm:rounded-xl sm:p-4">
                        <p className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-zinc-500 sm:mb-3 sm:text-[10px] dark:text-zinc-500">
                          Detay
                        </p>
                        <dl className="space-y-1.5 text-[11px] sm:space-y-2 sm:text-xs">
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

                  <p className="mt-3 text-[9px] leading-relaxed text-zinc-400 sm:mt-4 sm:text-[10px] dark:text-zinc-500">
                    Tahmindir. Maaş kümülatif matrahı ve kurum uygulamasına göre farklılık olabilir.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        ) : null}

        {/* admin save bar */}
        {canManage && adminOpen && catalog ? (
          <div className="fixed bottom-0 left-0 right-0 z-10 border-t bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur supports-backdrop-filter:bg-background/80 sm:p-4 md:pl-(--sidebar-width,0px)">
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

      {hasSelection && catalog && selectedCategory && selectedRole ? (
        <div
          ref={shareSnapshotRef}
          className="pointer-events-none fixed left-[-9999px] top-0 z-0 box-border overflow-hidden rounded-2xl border-2 border-violet-300 bg-white p-4 pb-14 text-zinc-900 shadow-2xl relative"
          style={{ fontFamily: 'system-ui, "Segoe UI", sans-serif', width: shareExportWidth }}
          aria-hidden
        >
          <div className="flex items-start justify-between gap-2 border-b border-violet-100 pb-3">
            <div className="min-w-0">
              <p className="text-[12px] font-bold uppercase tracking-wide text-violet-700">Sınav görev ücreti</p>
              <p className="mt-0.5 text-[10px] text-zinc-500">{catalog.period_label}</p>
            </div>
            <span className="shrink-0 rounded-lg bg-violet-100 px-2 py-1 text-[9px] font-semibold text-violet-800">
              Uzaedu Öğretmen
            </span>
          </div>

          <div
            className="mt-3 rounded-xl p-4 text-white shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #7c3aed 0%, #c026d3 50%, #d97706 100%)',
            }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/90">Tahmini net tutar</p>
            <p className="mt-2 text-[32px] font-bold leading-none tabular-nums tracking-tight">{formatTL(result.net)}</p>
            <p className="mt-2 text-[10px] leading-snug text-white/88">
              GV %{taxRate} · ‰{catalog.stamp_duty_rate_binde} DV
              {quantity > 1 ? ` · ${quantity} oturum` : ''}
            </p>
          </div>

          <div className="mt-3 space-y-2 border-b border-zinc-100 pb-3 text-[11px] leading-snug">
            <div className="flex justify-between gap-2">
              <span className="shrink-0 text-zinc-500">Kurum</span>
              <span className="min-w-0 text-right font-medium">
                {getCatMeta(selectedCategory.id).label || selectedCategory.label}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="shrink-0 text-zinc-500">Görev</span>
              <span className="min-w-0 text-right font-medium">{selectedRole.label}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-zinc-500">Birim brüt</span>
              <span className="font-semibold tabular-nums">{formatTL(result.unitBrut)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-zinc-500">Brüt toplam</span>
              <span className="font-semibold tabular-nums">{formatTL(result.totalBrut)}</span>
            </div>
          </div>

          <div className="mt-3 grid gap-1.5 rounded-xl bg-zinc-50 p-2.5 text-[11px]">
            <div className="flex justify-between gap-2 text-red-700">
              <span>GV kesintisi</span>
              <span className="shrink-0 font-semibold tabular-nums">−{formatTL(result.gvKesinti)}</span>
            </div>
            <div className="flex justify-between gap-2 text-red-700">
              <span>DV kesintisi</span>
              <span className="shrink-0 font-semibold tabular-nums">−{formatTL(result.dvKesinti)}</span>
            </div>
          </div>

          <p className="mt-3 text-[8px] leading-snug text-zinc-400">
            Tahminidir; maaş matrahı ve kurum uygulamasına göre farklılık olabilir.
          </p>
          <ShareCardPngFiligran variant="violet" />
        </div>
      ) : null}

      {shareSheetMounted &&
      hasSelection &&
      catalog &&
      selectedCategory &&
      selectedRole &&
      shareSheetOpen ? (
        <MobileShareSheetGlass
          titleId="sg-share-sheet-title"
          previewUrl={sharePreviewUrl}
          previewAlt="Sınav görev ücreti sonuç kartı önizlemesi"
          variant="violet"
          description={
            <>
              Aşağıdaki görsel, ekrandaki sonuç kartının PNG kopyasıdır; genişlik cihazınıza göre ayarlanır. Metin paylaşımında özet ve tam döküm için ipuçlarına bakın.
            </>
          }
          hints={[
            {
              icon: ImageIcon,
              title: 'Görsel kart',
              text: 'PNG önizlemesi paylaşılır; kartı yalnız panoya almak için aşağıdaki düğmeyi kullanın.',
            },
            {
              icon: Share2,
              title: 'Paylaşım menüsü',
              text: 'Kısa özet ve görsel çoğu uygulamada birlikte sunulur (cihaza göre değişebilir).',
            },
            {
              icon: Copy,
              title: 'Tam döküm',
              text: 'Tüm hesap satırları için “Tüm metni kopyala”yı kullanın.',
            },
          ]}
          onShare={() => {
            void performShare().finally(() => setShareSheetOpen(false));
          }}
          onCopyImage={copyShareImageOnly}
          onCopyText={copyShareText}
          onClose={() => setShareSheetOpen(false)}
        />
      ) : null}
    </div>
  );
}
