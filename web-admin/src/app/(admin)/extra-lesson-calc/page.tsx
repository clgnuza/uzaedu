'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useExtraLessonParams, useAvailableSemesters } from '@/hooks/use-extra-lesson-params';
import { Skeleton } from '@/components/ui/skeleton';
import {
  computeResult,
  getLineItemBrutPreview,
  parseNum,
  type EducationLevel,
  type Params,
} from '@/lib/extra-lesson-calc';
import {
  Activity,
  Calculator,
  RotateCcw,
  BookOpen,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  Calendar,
  GraduationCap,
  Info,
  Percent,
  Coins,
  Receipt,
  Share2,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch, getApiUrl, isAbortError } from '@/lib/api';
import { cn } from '@/lib/utils';

const UNVAN_OPTIONS = [
  { value: 'meb_kadrolu', label: 'Kadrolu' },
  { value: 'meb_sozlesmeli', label: 'Sözleşmeli' },
  { value: 'meb_ucretli', label: 'Ücretli' },
];

/** Ücretli öğretmen sadece bu 4 kalemi alabilir (MEB bordro). */
const UCRETLI_ALLOWED_KEYS = ['gunduz', 'gece', 'takviye_gunduz', 'takviye_gece'];

function formatTL(n: number): string {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2 }).format(n);
}

/** Büyük sayıları kısalt: 1234 → 1,2K, 1234567 → 1,2M */
function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}M`;
  if (n >= 1_000) return `${(n / 1_000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}K`;
  return n.toLocaleString('tr-TR');
}

// Dekoratif nokta deseni
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
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-5">
        <Skeleton className="h-56 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
      <Skeleton className="h-80 rounded-2xl lg:sticky lg:top-6" />
    </div>
  );
}

export default function ExtraLessonCalcPage() {
  const { token, role } = useAuth();
  const isGuest = !role;
  const [semesterCode, setSemesterCode] = useState('');
  const { params: p, loading, error } = useExtraLessonParams(token, semesterCode);
  const { semesters } = useAvailableSemesters(token);
  const hasAutoSelectedSemester = useRef(false);

  useEffect(() => {
    if (semesters.length > 0 && !hasAutoSelectedSemester.current) {
      hasAutoSelectedSemester.current = true;
      setSemesterCode(semesters[0]!.semester_code);
    }
  }, [semesters]);

  const [hours, setHours] = useState<Record<string, number>>({});
  const [centralExam, setCentralExam] = useState<string[]>(['', '', '', '']);
  const [educationKey, setEducationKey] = useState('lisans');
  const [unvan, setUnvan] = useState<'meb_kadrolu' | 'meb_sozlesmeli' | 'meb_ucretli'>('meb_kadrolu');
  const [taxRate, setTaxRate] = useState(15);
  const [taxMatrah, setTaxMatrah] = useState('');
  const [gvUsed, setGvUsed] = useState(0);
  const [dvUsed, setDvUsed] = useState(0);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ Ek_ders_saatleri: true, Merkezi_sinav: true });

  const educationLevels = p?.education_levels?.length
    ? p.education_levels
    : (p ? [{ key: 'lisans', label: 'Lisans', unit_day: 194.3, unit_night: 208.18 }] as EducationLevel[] : []);
  const education = useMemo(
    () => educationLevels.find((e) => e.key === educationKey) ?? educationLevels[0],
    [educationLevels, educationKey]
  );
  const hourlyLineItems = useMemo(
    () => (p?.line_items ?? []).filter((li) => li.type === 'hourly').sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99)),
    [p?.line_items]
  );

  const effectiveHourlyLineItems = useMemo(() => {
    if (unvan === 'meb_ucretli') {
      return hourlyLineItems.filter((li) => UCRETLI_ALLOWED_KEYS.includes(li.key));
    }
    return hourlyLineItems;
  }, [hourlyLineItems, unvan]);

  const hourlyGroups = useMemo(() => {
    const groups: { label: string; items: typeof effectiveHourlyLineItems }[] = [];
    const map = new Map<string, typeof effectiveHourlyLineItems>();
    for (const li of effectiveHourlyLineItems) {
      const k = li.key;
      const groupKey =
        k.startsWith('ozel_egitim') || k.includes('_25') ? 'ozel'
        : k.startsWith('cezaevi') ? 'cezaevi'
        : k.startsWith('takviye') ? 'takviye'
        : k.startsWith('iyep') ? 'iyep'
        : 'normal';
      if (!map.has(groupKey)) map.set(groupKey, []);
      map.get(groupKey)!.push(li);
    }
    const order = ['normal', 'ozel', 'cezaevi', 'takviye', 'iyep'] as const;
    const labels: Record<string, string> = {
      normal: 'Standart ek ders',
      ozel: 'Özel eğitim (%25)',
      cezaevi: 'Cezaevi görevi',
      takviye: 'Takviye (DYK)',
      iyep: 'İYEP',
    };
    for (const key of order) {
      const items = map.get(key);
      if (items?.length) groups.push({ label: labels[key] ?? key, items });
    }
    return groups;
  }, [effectiveHourlyLineItems]);

  const taxBrackets = p?.tax_brackets ?? [];
  const effectiveCentralExam = unvan === 'meb_ucretli' ? [] : centralExam.filter(Boolean);
  const result = useMemo(() => {
    if (!p || !education)
      return {
        totalBrut: 0,
        breakdown: [],
        gvKesinti: 0,
        dvKesinti: 0,
        sgkKesinti: 0,
        net: 0,
        taxOnBrut: 0,
        gvExemptionUsed: 0,
        gvExemptionRemaining: 0,
        dvExemptionMatrahUsed: 0,
        dvExemptionMatrahRemaining: 0,
        totalKesinti: 0,
      };
    return computeResult(p, hours, effectiveCentralExam, education, {
      taxRate,
      taxMatrah: parseNum(taxMatrah),
      taxBrackets,
      gvUsed,
      dvUsed,
      unvan,
    });
  }, [p, hours, effectiveCentralExam, education, taxRate, taxMatrah, taxBrackets, gvUsed, dvUsed, unvan]);

  const hasInput = Object.values(hours).some((v) => v && v > 0) || centralExam.some(Boolean);

  const inputSummary = useMemo(() => {
    const hourLines = effectiveHourlyLineItems
      .filter((li) => (hours[li.key] ?? 0) > 0)
      .map((li) => ({ key: li.key, label: li.label, h: hours[li.key] ?? 0 }));
    const totalHourly = hourLines.reduce((s, x) => s + x.h, 0);
    const examSlots = centralExam
      .map((key, i) => {
        if (!key) return null;
        const label = p?.central_exam_roles?.find((r) => r.key === key)?.label ?? key;
        return { slot: i + 1, label };
      })
      .filter(Boolean) as { slot: number; label: string }[];
    return { hourLines, totalHourly, examSlots };
  }, [effectiveHourlyLineItems, hours, centralExam, p?.central_exam_roles]);

  const handleHourChange = useCallback((key: string, value: number) => {
    setHours((prev) => {
      const next = { ...prev };
      if (value === 0) delete next[key];
      else next[key] = value;
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setHours({});
    setCentralExam(['', '', '', '']);
    setGvUsed(0);
    setDvUsed(0);
    setTaxMatrah('');
    setTaxRate(15);
  }, []);

  const resultCardRef = useRef<HTMLDivElement>(null);
  const [calcCount, setCalcCount] = useState(0);
  const lastCountedNetRef = useRef(0);

  /** Oturum kimliği – heartbeat için, sessionStorage ile kalıcı */
  const sessionId = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const key = 'ek_ders_calc_session_id';
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID?.() ?? `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(key, id);
    }
    return id;
  }, []);

  /** Global istatistikler – canlı kullanıcı + toplam hesaplama */
  const [stats, setStats] = useState<{ live_users: number; total_calculations: number } | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);

  useEffect(() => {
    if (result.net > 0 && result.net !== lastCountedNetRef.current) {
      setCalcCount((c) => c + 1);
      lastCountedNetRef.current = result.net;
      const ac = new AbortController();
      fetch(getApiUrl('/extra-lesson/stats/calc'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ac.signal,
      }).catch(() => {});
      return () => ac.abort();
    }
    if (result.net === 0) lastCountedNetRef.current = 0;
  }, [result.net]);

  /** Heartbeat – sekme gizliyken atlanır; interval unmount’ta temizlenir */
  useEffect(() => {
    if (!p || !sessionId) return;
    const sendHeartbeat = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      fetch(getApiUrl('/extra-lesson/stats/heartbeat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      }).catch(() => {});
    };
    sendHeartbeat();
    const iv = setInterval(sendHeartbeat, 45_000);
    const onVis = () => {
      if (document.visibilityState === 'visible') sendHeartbeat();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(iv);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [p, sessionId]);

  /** İstatistikleri poll et – önceki istek iptal, sekme gizliyken atla */
  useEffect(() => {
    if (!p) return;
    let inFlight: AbortController | null = null;
    const run = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      inFlight?.abort();
      inFlight = new AbortController();
      const { signal } = inFlight;
      apiFetch<{ live_users: number; total_calculations: number }>('/extra-lesson/stats', {
        cache: 'no-store',
        signal,
      })
        .then((data) => {
          setStats(data);
          setStatsError(null);
        })
        .catch((e) => {
          if (isAbortError(e)) return;
          setStats(null);
          setStatsError(e instanceof Error ? e.message : 'İstatistikler alınamadı');
        });
    };
    run();
    const iv = setInterval(run, 60_000);
    return () => {
      clearInterval(iv);
      inFlight?.abort();
    };
  }, [p]);

  const buildShareText = useCallback(() => {
    const unvanLabel = UNVAN_OPTIONS.find((o) => o.value === unvan)?.label ?? unvan;
    const eduLabel = educationLevels.find((e) => e.key === educationKey)?.label ?? educationKey;
    const dönemLabel = semesterCode ? semesters.find((s) => s.semester_code === semesterCode)?.title ?? p?.title ?? semesterCode : p?.title ?? 'Aktif dönem';

    const lines: string[] = [
      '═══════════════════════════════',
      '  EK DERS HESAPLAMA',
      '═══════════════════════════════',
      '',
      'GİRDİLER',
      `  Bütçe dönemi: ${dönemLabel}`,
      `  Ünvan: ${unvanLabel}`,
      `  Öğrenim: ${eduLabel}`,
    ];
    if (parseNum(taxMatrah) > 0) {
      lines.push(`  GV: GVK ücret tarifesi (dilim dilim, artımlı)`);
      lines.push(`  Önceki dönem brüt matrah: ${formatTL(parseNum(taxMatrah))}`);
    } else {
      lines.push(`  Vergi dilimi (kabaca): %${taxRate}`);
    }
    if (gvUsed > 0) lines.push(`  GV istisna kullanılan: ${formatTL(gvUsed)}`);
    if (dvUsed > 0) lines.push(`  DV istisna matrah kullanılan: ${formatTL(dvUsed)}`);

    const hourItems = effectiveHourlyLineItems.filter((li) => (hours[li.key] ?? 0) > 0);
    if (hourItems.length > 0) {
      lines.push('', 'Ek ders saatleri:');
      for (const li of hourItems) {
        lines.push(`  ${li.label}: ${hours[li.key]} saat`);
      }
    }
    const examSelected = centralExam.filter(Boolean).map((key) => p?.central_exam_roles?.find((r) => r.key === key)?.label ?? key);
    if (examSelected.length > 0) {
      lines.push('', 'Merkezi sınav:');
      examSelected.forEach((l, i) => lines.push(`  Görev ${i + 1}: ${l}`));
    }

    const totalH = hourItems.reduce((s, li) => s + (hours[li.key] ?? 0), 0);
    lines.push(
      '',
      'ÖZET (hesaplanan girdiler)',
      `  Toplam ek ders saati: ${totalH} saat`,
      `  Merkezi sınav görevi: ${examSelected.length} adet${examSelected.length === 0 ? ' (yok)' : ''}`,
    );

    lines.push(
      '',
      '───────────────────────────────',
      'SONUÇ',
      '───────────────────────────────',
      `  Net: ${formatTL(result.net)}`,
      `  Gelir toplamı (brüt): ${formatTL(result.totalBrut)}`,
      `  Kesinti toplamı: −${formatTL(result.totalKesinti)} (GV −${formatTL(result.gvKesinti)} | DV −${formatTL(result.dvKesinti)}${result.sgkKesinti > 0 ? ` | SGK −${formatTL(result.sgkKesinti)}` : ''})`,
      '',
      'Kalemler:',
      ...result.breakdown.map((b) => `  ${b.label}: ${formatTL(b.brut)}`),
      '',
      'Bilgilendirme amaçlıdır. Kesin tutar için kurumunuza danışın.'
    );
    return lines.join('\n');
  }, [
    result,
    unvan,
    educationKey,
    educationLevels,
    taxRate,
    taxMatrah,
    gvUsed,
    dvUsed,
    hours,
    centralExam,
    effectiveHourlyLineItems,
    semesters,
    semesterCode,
    p,
  ]);

  const handleShare = useCallback(async () => {
    const text = buildShareText();
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        let shareData: ShareData = { title: 'Ek Ders Hesaplama', text };
        let withImage = false;
        if (resultCardRef.current && typeof window !== 'undefined') {
          try {
            const html2canvas = (await import('html2canvas')).default;
            const canvas = await html2canvas(resultCardRef.current, {
              backgroundColor: '#ffffff',
              scale: 2,
              useCORS: true,
            });
            const blob = await new Promise<Blob | null>((resolve) =>
              canvas.toBlob(resolve, 'image/png', 0.95)
            );
            if (blob) {
              const file = new File([blob], 'ek-ders-sonuc.png', { type: 'image/png' });
              const withFile = { ...shareData, files: [file] } as ShareData;
              if (navigator.canShare?.(withFile)) {
                shareData = withFile;
                withImage = true;
              }
            }
          } catch {
            /* görsel oluşturulamazsa sadece metin paylaş */
          }
        }
        await navigator.share(shareData);
        toast.success(withImage ? 'Kart görseli + metin paylaşıldı' : 'Metin paylaşıldı (görsel eklenemedi veya desteklenmiyor)');
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        toast.success('Metin panoya kopyalandı');
      } else {
        toast.error('Paylaşım desteklenmiyor');
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      toast.error((e as Error).message || 'Paylaşılamadı');
    }
  }, [buildShareText]);

  const inputCls =
    'w-full min-h-[44px] rounded-xl border border-zinc-200 bg-white px-3.5 py-3 text-base transition-all placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500 sm:py-2.5 sm:text-sm';
  const labelCls =
    'mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-medium leading-snug text-zinc-500 dark:text-zinc-400';

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-sky-50/40 via-emerald-50/20 to-amber-50/30 dark:from-zinc-950 dark:via-emerald-950/10 dark:to-zinc-950">
      <div className="mx-auto max-w-6xl px-4 py-6 pb-8 sm:px-6 sm:py-8 sm:pb-12 lg:px-8" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>
        <header
          className={cn(
            'mb-10 flex flex-col gap-8 border-b border-zinc-200/80 pb-8 dark:border-zinc-800/80',
            isGuest && 'mb-8 gap-6 border-zinc-200/60 pb-6 dark:border-zinc-800/60',
          )}
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 max-w-2xl space-y-4">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
                  Hesaplama aracı
                </p>
                <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
                  Ek ders ücreti
                </h1>
              </div>
              <p className="max-w-xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 sm:text-base">
                Tüm girdiler brüt tutarlar üzerinden. Hesaplama brütten yapılır, sonuç net ücret olarak gösterilir.
              </p>
              {p && stats && (
                <dl
                  className={cn(
                    'grid grid-cols-2 gap-3 sm:max-w-xl',
                    calcCount > 0 ? 'sm:grid-cols-3' : 'sm:grid-cols-2',
                  )}
                >
                  <div className="rounded-xl border border-emerald-200/70 bg-white/90 px-4 py-3 shadow-sm dark:border-emerald-900/40 dark:bg-zinc-900/60">
                    <dt className="text-[11px] font-medium leading-snug text-zinc-500 dark:text-zinc-400">Canlı kullanıcı</dt>
                    <dd className="mt-1.5 flex flex-wrap items-baseline gap-1.5 sm:whitespace-nowrap">
                      <span className="text-xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">{stats.live_users}</span>
                      <span className="text-[11px] text-zinc-500 dark:text-zinc-400">şu an</span>
                    </dd>
                  </div>
                  <div className="rounded-xl border border-violet-200/70 bg-white/90 px-4 py-3 shadow-sm dark:border-violet-900/40 dark:bg-zinc-900/60">
                    <dt className="text-[11px] font-medium leading-snug text-zinc-500 dark:text-zinc-400">Toplam hesaplama</dt>
                    <dd className="mt-1.5 sm:whitespace-nowrap">
                      <span className="text-xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                        {formatCompact(stats.total_calculations)}
                      </span>
                    </dd>
                  </div>
                  {calcCount > 0 && (
                    <div className="col-span-2 rounded-xl border border-fuchsia-200/70 bg-gradient-to-br from-fuchsia-50/90 to-violet-50/80 px-4 py-3 shadow-sm dark:border-fuchsia-900/40 dark:from-fuchsia-950/30 dark:to-violet-950/25 sm:col-span-1">
                      <dt className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                        <Activity className="size-3.5 shrink-0 animate-pulse text-fuchsia-600 dark:text-fuchsia-400" strokeWidth={2} />
                        Bu oturumda
                      </dt>
                      <dd className="mt-1.5 sm:whitespace-nowrap">
                        <span className="text-xl font-bold tabular-nums text-fuchsia-800 dark:text-fuchsia-200">{calcCount}</span>
                      </dd>
                    </div>
                  )}
                </dl>
              )}
              {p && statsError && (
                <p role="status" className="mt-2 max-w-xl text-xs leading-snug text-amber-800 dark:text-amber-200/90">
                  {statsError}
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2 lg:flex-col lg:items-stretch lg:pt-1">
              {hasInput && p && (
                <button
                  type="button"
                  onClick={handleShare}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-500 px-4 py-3 text-sm font-medium text-white shadow-sm transition-all hover:border-emerald-400 hover:bg-emerald-600 active:scale-[0.98] dark:border-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                >
                  <Share2 className="size-4" strokeWidth={2} />
                  Paylaş
                </button>
              )}
              <button
                type="button"
                onClick={reset}
                className="group inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-5 py-3 text-sm font-medium text-amber-800 transition-all hover:border-amber-300 hover:bg-amber-100 active:scale-[0.98] dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:border-amber-700 dark:hover:bg-amber-950/60"
              >
                <RotateCcw className="size-4 text-amber-600 transition-transform group-hover:-rotate-180 group-hover:duration-500 dark:text-amber-400" strokeWidth={2} />
                Sıfırla
              </button>
            </div>
          </div>
        </header>

        {loading && !p && <CalcSkeleton />}

        {!p && !loading && (
          <div className="relative overflow-hidden rounded-2xl border border-amber-200/70 bg-amber-50/50 p-10 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
            <DotPattern />
            <div className="relative flex flex-col items-center justify-center text-center">
              <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/30">
                <Sparkles className="size-8 text-amber-600 dark:text-amber-500" strokeWidth={1.5} />
              </div>
              <p className="text-base text-zinc-600 dark:text-zinc-400">
                {semesters.length === 0
                  ? 'Henüz tanımlanmış bütçe dönemi yok. Superadmin parametre ekleyene kadar hesaplama yapılamaz.'
                  : 'Parametreler yüklenemedi. Lütfen bütçe dönemi seçip tekrar deneyin.'}
              </p>
              {error && semesters.length === 0 && (
                <p role="alert" className="mt-1 text-[11px] leading-snug text-red-600 dark:text-red-500">
                  {error}
                </p>
              )}
              {semesters.length > 0 && (
                <div className="mt-8 w-full max-w-xs">
                  <label className={labelCls}>
                    <Calendar className="size-3.5" />
                    Bütçe dönemi
                  </label>
                  <select value={semesterCode} onChange={(e) => setSemesterCode(e.target.value)} className={inputCls}>
                    <option value="">Aktif dönem</option>
                    {semesters.map((s) => (
                      <option key={s.semester_code} value={s.semester_code}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                  {error && (
                    <p role="alert" className="mt-1 text-[11px] leading-snug text-red-600 dark:text-red-500">
                      {error}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {p && (
          <div className="flex min-w-0 flex-col gap-6 lg:grid lg:grid-cols-[1fr_360px]">
            <div className="min-w-0 space-y-6 lg:order-1">
              <section className="relative overflow-hidden rounded-2xl border border-emerald-200/60 bg-white p-6 shadow-sm dark:border-emerald-900/50 dark:bg-zinc-900">
                <div className="absolute left-0 top-0 h-full w-1.5 rounded-l-2xl bg-gradient-to-b from-emerald-500 via-teal-500 to-cyan-500" />
                <DotPattern />
                <div className="relative mb-5 flex min-w-0 flex-wrap items-center justify-between gap-3">
                  <h2 className="flex items-center gap-2.5 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20">
                      <Calculator className="size-4 text-emerald-600 dark:text-emerald-400" strokeWidth={2} />
                    </span>
                    Ayarlar
                  </h2>
                  {p.title && (
                    <span
                      className="min-w-0 max-w-[min(100%,14rem)] shrink truncate rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                      title={p.title}
                    >
                      {p.title}
                    </span>
                  )}
                </div>
                <div className="relative space-y-6">
                  {/* Genel — mobilde tek sütun, sm+ iki sütun */}
                  <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="min-w-0">
                      <label className={`${labelCls} break-words`}>
                        <Calendar className="size-3.5 shrink-0 text-sky-500 dark:text-sky-400" />
                        Bütçe dönemi
                      </label>
                      <select
                        value={semesterCode}
                        onChange={(e) => setSemesterCode(e.target.value)}
                        className={`${inputCls} truncate`}
                        title={semesters.find((s) => s.semester_code === semesterCode)?.title ?? ''}
                      >
                        <option value="">Aktif dönem</option>
                        {semesters.map((s) => (
                          <option key={s.semester_code} value={s.semester_code} title={s.title}>
                            {s.title}
                          </option>
                        ))}
                      </select>
                      {error && (
                        <p role="alert" className="mt-1 text-[11px] leading-snug text-red-600 dark:text-red-500">
                          {error}
                        </p>
                      )}
                    </div>
                    <div className="min-w-0">
                      <label className={`${labelCls} break-words`}>
                        <GraduationCap className="size-3.5 shrink-0 text-amber-500 dark:text-amber-400" />
                        Ünvan
                        {(unvan === 'meb_ucretli' || unvan === 'meb_sozlesmeli') && (
                          <span className="group relative ml-1.5 inline-flex">
                            <Info
                              className="size-4 shrink-0 cursor-help text-sky-500 dark:text-sky-400"
                              aria-label="Ünvan bilgisi"
                            />
                            <span
                              role="tooltip"
                              className="absolute left-0 top-full z-50 mt-1.5 min-w-[220px] max-w-[300px] rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-[11px] leading-snug text-sky-900 shadow-md dark:border-sky-800 dark:bg-sky-950/90 dark:text-sky-100 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                            >
                              {unvan === 'meb_ucretli'
                                ? 'Ücretli: Kadrolu ile aynı brüt. SGK kesilir. Öğrenim farkı yok. Oran parametreden (1 veya 0,725).'
                                : 'Sözleşmeli: Birim ücret kadrolu ile aynı. SGK+İşsizlik kesilir. GV/DV istisnaları maaşta kullandığınız değerleri girin.'}
                            </span>
                          </span>
                        )}
                      </label>
                      <select
                        value={unvan}
                        onChange={(e) => setUnvan(e.target.value as 'meb_kadrolu' | 'meb_sozlesmeli' | 'meb_ucretli')}
                        className={inputCls}
                      >
                        {UNVAN_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="min-w-0">
                      <label className={`${labelCls} break-words`}>
                        <GraduationCap className="size-3.5 shrink-0 text-amber-500 dark:text-amber-400" />
                        Öğrenim durumu
                      </label>
                      <select value={educationKey} onChange={(e) => setEducationKey(e.target.value)} className={inputCls}>
                        {educationLevels.map((e) => (
                          <option key={e.key} value={e.key}>
                            {e.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="min-w-0">
                      <label className={`${labelCls} break-words`}>
                        <Percent className="size-3.5 shrink-0 text-rose-500 dark:text-rose-400" />
                        Vergi dilimi
                      </label>
                      <select
                        value={taxRate}
                        onChange={(e) => {
                          setTaxRate(Number(e.target.value));
                          setTaxMatrah('');
                        }}
                        className={inputCls}
                      >
                        {(taxBrackets.length ? taxBrackets : [
                          { max_matrah: 190000, rate_percent: 15 },
                          { max_matrah: 400000, rate_percent: 20 },
                          { max_matrah: 1500000, rate_percent: 27 },
                          { max_matrah: 5300000, rate_percent: 35 },
                          { max_matrah: 999999999, rate_percent: 40 },
                        ]).map((b, i) => (
                          <option key={i} value={b.rate_percent}>
                            %{b.rate_percent}{' '}
                            {b.max_matrah >= 10000000 ? '(≥5,3M)' : `(≤${(b.max_matrah / 1000).toFixed(0)}k)`}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-[11px] leading-snug text-zinc-500 dark:text-zinc-500">
                        Matrah girilmediyse kabaca tahmin için tek oran kullanılır.
                      </p>
                    </div>
                  </div>
                  {/* Vergi istisnaları - 2 sütun, daha geniş */}
                  <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="min-w-0">
                      <label className={`${labelCls} break-words`}>
                        <Coins className="size-3.5 shrink-0 text-amber-500 dark:text-amber-400" />
                        Geçen aylar vergi matrahı (brüt)
                      </label>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={0.01}
                        placeholder="Bu yıl geçen aylar brüt"
                        value={taxMatrah}
                        onChange={(e) => setTaxMatrah(e.target.value)}
                        className={inputCls}
                      />
                      <p className="mt-1 text-[11px] leading-snug text-zinc-500 dark:text-zinc-500">
                        Bu ödemeye kadar toplam brüt ücret matrahı (net değil). Girildiğinde GV, GVK ücret tarifesine göre dilim dilim (artımlı) hesaplanır.
                      </p>
                    </div>
                    <div className="min-w-0">
                      <label className={`${labelCls} break-words`}>
                        <Coins className="size-3.5 shrink-0 text-amber-500 dark:text-amber-400" />
                        GV istisna faydalanılan
                      </label>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={0.01}
                        value={gvUsed || ''}
                        onChange={(e) => setGvUsed(parseNum(e.target.value))}
                        placeholder="0"
                        className={`${inputCls} text-right`}
                      />
                      <p className="mt-1 text-[11px] leading-snug text-zinc-500 dark:text-zinc-500">
                        Maaşta kullanılan vergi tutarı. Max {formatTL(parseNum(p.gv_exemption_max))}
                      </p>
                    </div>
                    <div className="min-w-0 sm:col-span-2 lg:col-span-1">
                      <label className={`${labelCls} break-words`}>
                        <Coins className="size-3.5 shrink-0 text-amber-500 dark:text-amber-400" />
                        DV istisna matrah faydalanılan
                      </label>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={0.01}
                        value={dvUsed || ''}
                        onChange={(e) => setDvUsed(parseNum(e.target.value))}
                        placeholder="0"
                        className={`${inputCls} text-right`}
                      />
                      <p className="mt-1 text-[11px] leading-snug text-zinc-500 dark:text-zinc-500">
                        Maaşta kullanılan brüt matrah. Max {formatTL(parseNum(p.dv_exemption_max))}
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {effectiveHourlyLineItems.length > 0 && (
                <section className="min-w-0 overflow-hidden rounded-2xl border border-sky-200/70 bg-white shadow-sm dark:border-sky-900/40 dark:bg-zinc-900">
                  <button
                    type="button"
                    onClick={() =>
                      setExpanded((e) => ({ ...e, Ek_ders_saatleri: !(e.Ek_ders_saatleri ?? true) }))
                    }
                    className="flex min-h-[48px] w-full touch-manipulation items-center justify-between px-5 py-4 text-left transition-colors active:bg-sky-50 sm:px-6 sm:hover:bg-sky-50/50 dark:active:bg-sky-950/30 dark:sm:hover:bg-sky-950/20"
                  >
                    <span className="flex items-center gap-3 font-semibold text-zinc-900 dark:text-zinc-100">
                      <span className="flex size-9 items-center justify-center rounded-lg bg-sky-500/15 dark:bg-sky-500/25">
                        <BookOpen className="size-4.5 text-sky-600 dark:text-sky-400" strokeWidth={2} />
                      </span>
                      Ek ders saatleri
                    </span>
                    <span className="flex items-center gap-3">
                      {effectiveHourlyLineItems.some((li) => (hours[li.key] ?? 0) > 0) && (
                        <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/25 dark:text-emerald-400">
                          Dolu
                        </span>
                      )}
                      <span className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800">
                        {(expanded.Ek_ders_saatleri ?? true) ? (
                          <ChevronUp className="size-5 text-zinc-500" strokeWidth={2} />
                        ) : (
                          <ChevronDown className="size-5 text-zinc-500" strokeWidth={2} />
                        )}
                      </span>
                    </span>
                  </button>
                  {(expanded.Ek_ders_saatleri ?? true) && (
                    <div className="min-w-0 space-y-5 border-t border-sky-200/50 bg-sky-50/40 p-4 dark:border-sky-900/30 dark:bg-sky-950/20 sm:p-5">
                      {effectiveCentralExam.length > 0 &&
                        !effectiveHourlyLineItems.some((li) => (hours[li.key] ?? 0) > 0) && (
                        <p className="text-[11px] leading-snug text-sky-600 dark:text-sky-500">
                          Merkezi sınav görevine ek olarak gündüz/gece ek dersi de varsa aşağıdaki alanlara saat girin.
                        </p>
                      )}
                      {hourlyGroups.map((group) => (
                        <div key={group.label} className="min-w-0 space-y-2">
                          <h3 className="block w-full text-base font-semibold text-zinc-700 dark:text-zinc-300 [overflow-wrap:anywhere]">
                            {group.label}
                          </h3>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {group.items.map((li) => {
                              const h = hours[li.key] ?? 0;
                              const useNight = li.key === 'gece' || li.key.endsWith('_gece');
                              return (
                                <div
                                  key={li.key}
                                  className={`flex flex-col gap-2 rounded-xl border px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3 ${
                                    useNight
                                      ? 'border-indigo-200/60 bg-indigo-50/30 dark:border-indigo-900/40 dark:bg-indigo-950/20'
                                      : 'border-sky-200/50 bg-white dark:border-sky-900/30 dark:bg-zinc-900'
                                  }`}
                                >
                                  <span className="min-w-0 w-full text-sm font-medium leading-snug text-zinc-800 break-words sm:flex-1 dark:text-zinc-200">
                                    {li.label}
                                  </span>
                                  <div className="flex shrink-0 flex-col items-end gap-0.5 self-end sm:self-start">
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="number"
                                        inputMode="numeric"
                                        min={0}
                                        step={1}
                                        value={h || ''}
                                        onChange={(e) => handleHourChange(li.key, Math.round(parseNum(e.target.value)))}
                                        placeholder="0"
                                        className="min-h-[40px] w-16 rounded-lg border border-zinc-200 bg-white px-2 py-2 text-right text-sm tabular-nums focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 sm:w-14"
                                        aria-label={`${li.label} saat`}
                                      />
                                      <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">saat</span>
                                    </div>
                                    {h > 0 && p && (
                                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                                        ≈ {formatTL(getLineItemBrutPreview(p, li, h, education, unvan))}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {p.central_exam_roles && p.central_exam_roles.length > 0 && unvan !== 'meb_ucretli' && (
                <section className="overflow-hidden rounded-2xl border border-violet-200/70 bg-white shadow-sm dark:border-violet-900/40 dark:bg-zinc-900">
                  <button
                    type="button"
                    onClick={() =>
                      setExpanded((e) => ({ ...e, Merkezi_sinav: !(e.Merkezi_sinav ?? true) }))
                    }
                    className="flex min-h-[48px] w-full touch-manipulation items-center justify-between px-5 py-4 text-left transition-colors active:bg-violet-50 sm:px-6 sm:hover:bg-violet-50/50 dark:active:bg-violet-950/30 dark:sm:hover:bg-violet-950/20"
                  >
                    <span className="flex items-center gap-3 font-semibold text-zinc-900 dark:text-zinc-100">
                      <span className="flex size-9 items-center justify-center rounded-lg bg-violet-500/15 dark:bg-violet-500/25">
                        <ClipboardList className="size-4.5 text-violet-600 dark:text-violet-400" strokeWidth={2} />
                      </span>
                      Merkezi sınav görevi
                    </span>
                    <span className="flex items-center gap-3">
                      {centralExam.some(Boolean) && (
                        <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/25 dark:text-emerald-400">
                          Seçili
                        </span>
                      )}
                      <span className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800">
                        {(expanded.Merkezi_sinav ?? true) ? (
                          <ChevronUp className="size-5 text-zinc-500" strokeWidth={2} />
                        ) : (
                          <ChevronDown className="size-5 text-zinc-500" strokeWidth={2} />
                        )}
                      </span>
                    </span>
                  </button>
                  {(expanded.Merkezi_sinav ?? true) && (
                    <div className="grid gap-3 border-t border-violet-200/50 bg-violet-50/40 p-5 dark:border-violet-900/30 dark:bg-violet-950/20 sm:grid-cols-2">
                      {[0, 1, 2, 3].map((i) => (
                        <div key={i}>
                          <label className={labelCls}>Görev {i + 1}</label>
                          <select
                            value={centralExam[i] ?? ''}
                            onChange={(e) => {
                              const v = [...centralExam];
                              v[i] = e.target.value;
                              setCentralExam(v);
                            }}
                            className={inputCls}
                          >
                            <option value="">Görev yok</option>
                            {p.central_exam_roles!.map((r) => (
                              <option key={r.key} value={r.key}>
                                {r.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}
            </div>

            <aside
              className="order-2 lg:sticky lg:top-6 lg:self-start"
              role="region"
              aria-live="polite"
              aria-label="Hesaplama sonucu"
            >
              <div
                ref={resultCardRef}
                className="relative overflow-hidden rounded-t-3xl border border-emerald-200/80 border-b-0 bg-white shadow-[0_-8px_32px_-8px_rgba(0,0,0,0.1)] dark:border-emerald-900/50 dark:bg-zinc-900 lg:rounded-2xl lg:border-b lg:shadow-lg"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-cyan-500/5" />
                <DotPattern />
                <div className="relative p-6 pb-8 sm:pb-6" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
                  <div className="mb-5 flex justify-center lg:hidden">
                    <span className="h-1 w-12 rounded-full bg-emerald-300/60 dark:bg-emerald-600/50" aria-hidden="true" />
                  </div>
                  <h2 className="mb-5 flex items-center gap-2.5 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20">
                      <Receipt className="size-4 text-emerald-600 dark:text-emerald-400" strokeWidth={2} />
                    </span>
                    Sonuç
                  </h2>
                  {!hasInput ? (
                    <div className="flex flex-col items-center py-12 text-center">
                      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800">
                        <Calculator className="size-7 text-zinc-400 dark:text-zinc-500" strokeWidth={1.5} />
                      </div>
                      <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                        Saat girin veya merkezi sınav seçin, hesaplama anında görünür.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="mb-6 rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-600 p-6 text-white shadow-lg shadow-emerald-500/25">
                        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-100">
                          Brütten hesaplanan net tutar
                        </p>
                        <p className="mt-3 text-3xl font-bold tabular-nums sm:text-4xl">
                          {formatTL(result.net)}
                        </p>
                        <p className="mt-2 text-[11px] text-emerald-100/90">
                          Tahmini net ücret
                          {result.sgkKesinti > 0 ? ' (GV, DV ve Sigorta primi düşülmüş)' : ' (GV ve DV kesintileri düşülmüş)'}
                        </p>
                      </div>

                      {(inputSummary.hourLines.length > 0 || inputSummary.examSlots.length > 0) && (
                        <div className="mb-5 rounded-xl border border-emerald-200/70 bg-emerald-50/40 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                          <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                            Hesaplanan girdiler
                          </p>
                          {inputSummary.hourLines.length > 0 && (
                            <ul className="mb-2 space-y-1 text-xs text-zinc-700 dark:text-zinc-300">
                              {inputSummary.hourLines.map((row) => (
                                <li key={row.key} className="flex justify-between gap-2">
                                  <span className="min-w-0 truncate">{row.label}</span>
                                  <span className="shrink-0 tabular-nums font-medium">{row.h} saat</span>
                                </li>
                              ))}
                              <li className="flex justify-between gap-2 border-t border-emerald-200/60 pt-2 font-semibold text-zinc-900 dark:text-zinc-100">
                                <span>Toplam ek ders saati</span>
                                <span className="tabular-nums">{inputSummary.totalHourly} saat</span>
                              </li>
                            </ul>
                          )}
                          {inputSummary.examSlots.length > 0 && (
                            <ul className="space-y-1 border-t border-emerald-200/50 pt-2 text-xs text-zinc-700 dark:border-emerald-900/40 dark:text-zinc-300">
                              {inputSummary.examSlots.map((ex) => (
                                <li key={ex.slot} className="flex justify-between gap-2">
                                  <span className="min-w-0 truncate">Görev {ex.slot}</span>
                                  <span className="min-w-0 text-right font-medium">{ex.label}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}

                      <dl className="space-y-2.5 text-sm">
                        <div className="flex justify-between rounded-lg bg-zinc-50 px-3 py-2.5 dark:bg-zinc-800/50">
                          <dt className="text-zinc-600 dark:text-zinc-400">Gelir toplamı (brüt)</dt>
                          <dd className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{formatTL(result.totalBrut)}</dd>
                        </div>
                        <div className="flex justify-between rounded-lg bg-red-50 px-3 py-2.5 dark:bg-red-950/30">
                          <dt className="text-red-700 dark:text-red-400">Gelir vergisi</dt>
                          <dd className="tabular-nums font-medium text-red-700 dark:text-red-400">−{formatTL(result.gvKesinti)}</dd>
                        </div>
                        <div className="flex justify-between rounded-lg bg-red-50 px-3 py-2.5 dark:bg-red-950/30">
                          <dt className="text-red-700 dark:text-red-400">Damga vergisi</dt>
                          <dd className="tabular-nums font-medium text-red-700 dark:text-red-400">−{formatTL(result.dvKesinti)}</dd>
                        </div>
                        {result.sgkKesinti > 0 && (
                          <div className="flex justify-between rounded-lg bg-red-50 px-3 py-2.5 dark:bg-red-950/30">
                            <dt className="text-red-700 dark:text-red-400">Sigorta primi</dt>
                            <dd className="tabular-nums font-medium text-red-700 dark:text-red-400">−{formatTL(result.sgkKesinti)}</dd>
                          </div>
                        )}
                        {result.totalKesinti > 0 && (
                          <div className="flex justify-between rounded-lg border border-red-200/80 bg-red-50/90 px-3 py-2.5 dark:border-red-900/50 dark:bg-red-950/40">
                            <dt className="font-medium text-red-800 dark:text-red-300">Kesinti toplamı</dt>
                            <dd className="tabular-nums font-semibold text-red-800 dark:text-red-300">−{formatTL(result.totalKesinti)}</dd>
                          </div>
                        )}
                      </dl>

                      <div className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-800/30">
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-500">
                          Hesaplanan diğer veriler
                        </p>
                        <dl className="space-y-2 text-xs">
                          {result.taxOnBrut > 0 && (
                            <div className="flex justify-between gap-2">
                              <dt className="text-zinc-600 dark:text-zinc-400">GV hesaplanan (istisna öncesi)</dt>
                              <dd className="tabular-nums font-medium">{formatTL(result.taxOnBrut)}</dd>
                            </div>
                          )}
                          {(result.gvExemptionUsed > 0 || result.gvExemptionRemaining > 0) && (
                            <>
                              {result.gvExemptionUsed > 0 && (
                                <div className="flex justify-between gap-2">
                                  <dt className="text-zinc-600 dark:text-zinc-400">GV İstisnası (Faydalanılan)</dt>
                                  <dd className="tabular-nums font-medium">{formatTL(result.gvExemptionUsed)}</dd>
                                </div>
                              )}
                              {result.gvExemptionRemaining > 0 && (
                                <div className="flex justify-between gap-2">
                                  <dt className="text-zinc-600 dark:text-zinc-400">GV İstisnası (Kalan)</dt>
                                  <dd className="tabular-nums font-medium">{formatTL(result.gvExemptionRemaining)}</dd>
                                </div>
                              )}
                            </>
                          )}
                          {(result.dvExemptionMatrahUsed > 0 || result.dvExemptionMatrahRemaining > 0) && (
                            <>
                              {result.dvExemptionMatrahUsed > 0 && (
                                <div className="flex justify-between gap-2">
                                  <dt className="text-zinc-600 dark:text-zinc-400">DV İst. Uyg. Mat. (Faydalanılan)</dt>
                                  <dd className="tabular-nums font-medium">{formatTL(result.dvExemptionMatrahUsed)}</dd>
                                </div>
                              )}
                              {result.dvExemptionMatrahRemaining > 0 && (
                                <div className="flex justify-between gap-2">
                                  <dt className="text-zinc-600 dark:text-zinc-400">DV İst. Uyg. Mat. (Kalan)</dt>
                                  <dd className="tabular-nums font-medium">{formatTL(result.dvExemptionMatrahRemaining)}</dd>
                                </div>
                              )}
                            </>
                          )}
                        </dl>
                        <p className="mt-3 text-[10px] text-zinc-500 dark:text-zinc-500">
                          Sıfır olan alanlar gösterilmemektedir.
                        </p>
                      </div>

                      {result.breakdown.length > 0 && (
                        <div className="mt-5 border-t border-zinc-200 pt-5 dark:border-zinc-800">
                          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
                            Kalem dökümü (brüt)
                          </p>
                          <ul className="max-h-44 space-y-2 overflow-y-auto pr-1 text-xs">
                            {result.breakdown.map((b) => (
                              <li key={b.label} className="flex justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                <span className="truncate text-zinc-600 dark:text-zinc-400">{b.label}</span>
                                <span className="shrink-0 tabular-nums font-medium text-zinc-900 dark:text-zinc-200">
                                  {formatTL(b.brut)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                  <p className="mt-5 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-500">
                    Girdiler brüt tutarlar üzerinden; hesaplama brütten yapılır, sonuç net gösterilir. Bilgilendirme amaçlıdır. Kesin tutar için kurumunuza danışın.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
