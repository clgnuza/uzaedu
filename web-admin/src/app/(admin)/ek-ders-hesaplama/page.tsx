'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { useExtraLessonParams, useAvailableSemesters } from '@/hooks/use-extra-lesson-params';
import { Skeleton } from '@/components/ui/skeleton';
import {
  computeResult,
  getLineItemBrutPreview,
  parseNum,
  type EducationLevel,
} from '@/lib/extra-lesson-calc';
import {
  Activity,
  ArrowLeft,
  Calculator,
  RotateCcw,
  BookOpen,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  Calendar,
  GraduationCap,
  HelpCircle,
  Info,
  Percent,
  Coins,
  Receipt,
  Share2,
  Sparkles,
  Minus,
  Plus,
  Copy,
  Image as ImageIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch, isAbortError } from '@/lib/api';
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

async function captureEkDersCardAsPng(
  primary: HTMLElement | null,
  fallback: HTMLElement | null
): Promise<Blob | null> {
  const el = primary ?? fallback;
  if (!el || typeof window === 'undefined') return null;
  try {
    const html2canvas = (await import('html2canvas')).default;
    const dpr = window.devicePixelRatio || 2;
    const canvas = await html2canvas(el, {
      backgroundColor: '#ffffff',
      scale: Math.min(3, Math.max(2, dpr)),
      useCORS: true,
      logging: false,
      scrollX: 0,
      scrollY: 0,
      ignoreElements: (node) =>
        node instanceof HTMLElement && node.hasAttribute('data-html2canvas-ignore'),
      onclone: (clonedDoc) => {
        clonedDoc.documentElement.classList.remove('dark');
        clonedDoc.documentElement.style.colorScheme = 'light';
      },
    });
    return await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), 'image/png', 0.96));
  } catch {
    return null;
  }
}

function CalcSkeleton() {
  return (
    <div className="flex min-w-0 flex-col gap-4 sm:gap-6 lg:grid lg:grid-cols-[1fr_360px]">
      <div className="min-w-0 space-y-4 sm:space-y-6">
        <Skeleton className="h-48 rounded-xl sm:h-56 sm:rounded-2xl" />
        <Skeleton className="h-64 rounded-xl sm:h-72 sm:rounded-2xl" />
      </div>
      <Skeleton className="h-72 rounded-t-2xl sm:h-80 sm:rounded-2xl lg:sticky lg:top-6 lg:self-start" />
    </div>
  );
}

const FIELD_HINT = {
  vergiDilimi:
    'Matrah girilmediyse kabaca tahmin için tek oran kullanılır. Geçen aylar brüt matrahı girildiğinde GV, GVK ücret tarifesine göre dilim dilim (artımlı) hesaplanır.',
  matrah:
    'Bu ödemeye kadar toplam brüt ücret matrahı (net değil). Girildiğinde GV, GVK ücret tarifesine göre dilim dilim (artımlı) hesaplanır.',
  ekDersSaatleri:
    'EDYGG (diğer ücret türleri) ayrı satırlardır; nöbet, belleticilik, sınav, egzersiz, hizmet içi ile EDYGG öğrenim ücret farkı uygulanmaz (lisans birim ücreti). Gündüz/gece ve DYK ayrı satırlardır. ≈ brüt önizleme; kalem sırası parametre şablonundaki gibi.',
} as const;

type HintAccent = 'emerald' | 'sky' | 'violet' | 'zinc';

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

const stepperSideBtn =
  'flex size-9 shrink-0 items-center justify-center border-zinc-200 bg-zinc-50 text-zinc-700 transition hover:bg-zinc-100 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-35 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700/80';

function HourQuantityStepper({
  hours,
  onHours,
  ariaLabel,
}: {
  hours: number;
  onHours: (n: number) => void;
  ariaLabel: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-stretch overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-800/50">
        <button
          type="button"
          className={cn(stepperSideBtn, 'rounded-l-md border-r')}
          aria-label="Bir saat azalt"
          disabled={hours <= 0}
          onClick={() => onHours(Math.max(0, hours - 1))}
        >
          <Minus className="size-4" strokeWidth={2.5} />
        </button>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          value={hours || ''}
          onChange={(e) => onHours(Math.max(0, Math.round(parseNum(e.target.value))))}
          className="w-11 border-0 bg-transparent px-1 py-1 text-center text-sm font-medium tabular-nums text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500/40 dark:text-zinc-100"
          aria-label={ariaLabel}
        />
        <button
          type="button"
          className={cn(stepperSideBtn, 'rounded-r-md border-l')}
          aria-label="Bir saat artır"
          onClick={() => onHours(hours + 1)}
        >
          <Plus className="size-4" strokeWidth={2.5} />
        </button>
      </div>
      <span className="shrink-0 text-[11px] text-zinc-500 dark:text-zinc-400">saat</span>
    </div>
  );
}

function MatrahStepper({
  value,
  onChange,
  step,
  placeholder,
}: {
  value: string;
  onChange: (s: string) => void;
  step: number;
  placeholder?: string;
}) {
  const n = parseNum(value);
  const bump = (dir: -1 | 1) => {
    const x = roundMoney(Math.max(0, n + dir * step));
    onChange(x === 0 ? '' : String(x));
  };
  return (
    <div className="flex items-stretch overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
      <button
        type="button"
        className={cn(stepperSideBtn, 'rounded-l-md border-r')}
        aria-label="Azalt"
        disabled={n <= 0}
        onClick={() => bump(-1)}
      >
        <Minus className="size-3.5" strokeWidth={2.5} />
      </button>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step={0.01}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-9 min-w-0 flex-1 border-x border-zinc-200 bg-transparent px-2 py-1 text-[13px] tabular-nums text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500/40 dark:border-zinc-600 dark:text-zinc-100 sm:min-h-10 sm:text-sm"
      />
      <button type="button" className={cn(stepperSideBtn, 'rounded-r-md border-l')} aria-label="Artır" onClick={() => bump(1)}>
        <Plus className="size-3.5" strokeWidth={2.5} />
      </button>
    </div>
  );
}

function MoneyNumericStepper({
  value,
  onChange,
  step,
  max,
  placeholder,
}: {
  value: number;
  onChange: (n: number) => void;
  step: number;
  max?: number;
  placeholder?: string;
}) {
  const bump = (dir: -1 | 1) => {
    let n = roundMoney(value + dir * step);
    n = Math.max(0, n);
    if (max != null) n = Math.min(n, max);
    onChange(n);
  };
  const atMax = max != null && value >= max - 1e-9;
  return (
    <div className="flex items-stretch overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
      <button
        type="button"
        className={cn(stepperSideBtn, 'rounded-l-md border-r')}
        aria-label="Azalt"
        disabled={value <= 0}
        onClick={() => bump(-1)}
      >
        <Minus className="size-3.5" strokeWidth={2.5} />
      </button>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step={0.01}
        placeholder={placeholder}
        value={value || ''}
        onChange={(e) => onChange(roundMoney(parseNum(e.target.value)))}
        className="min-h-9 min-w-0 flex-1 border-x border-zinc-200 bg-transparent px-2 py-1 text-right text-[13px] tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500/40 dark:border-zinc-600 sm:min-h-10 sm:text-sm"
      />
      <button
        type="button"
        className={cn(stepperSideBtn, 'rounded-r-md border-l')}
        aria-label="Artır"
        disabled={atMax}
        onClick={() => bump(1)}
      >
        <Plus className="size-3.5" strokeWidth={2.5} />
      </button>
    </div>
  );
}

function SectionInfoHint({
  id,
  label,
  accent = 'emerald',
  children,
}: {
  id: string;
  label: string;
  accent?: HintAccent;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const accentBtn: Record<HintAccent, string> = {
    emerald:
      'text-emerald-600 hover:bg-emerald-500/15 focus-visible:ring-emerald-500/40 dark:text-emerald-400 dark:hover:bg-emerald-500/10',
    sky: 'text-sky-600 hover:bg-sky-500/15 focus-visible:ring-sky-500/40 dark:text-sky-400 dark:hover:bg-sky-500/10',
    violet:
      'text-violet-600 hover:bg-violet-500/15 focus-visible:ring-violet-500/40 dark:text-violet-400 dark:hover:bg-violet-500/10',
    zinc: 'text-zinc-500 hover:bg-zinc-500/10 focus-visible:ring-zinc-500/30 dark:text-zinc-400',
  };

  return (
    <span ref={wrapRef} className="group/hint relative inline-flex shrink-0 outline-none">
      <button
        type="button"
        className={cn(
          'rounded-full p-1 outline-offset-2 transition-colors focus-visible:ring-2',
          accentBtn[accent],
        )}
        aria-label={label}
        aria-expanded={open}
        aria-controls={`${id}-hint-panel`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        <HelpCircle className="size-[18px] sm:size-5" strokeWidth={2} aria-hidden />
      </button>
      <span
        id={`${id}-hint-panel`}
        role="tooltip"
        className={cn(
          'pointer-events-auto absolute left-0 top-full z-[60] mt-2 w-[min(18rem,calc(100vw-2rem))] max-w-[min(100vw-2rem,20rem)] rounded-lg border border-border bg-popover px-3 py-2.5 text-[11px] leading-snug text-popover-foreground shadow-md transition-opacity duration-150',
          'invisible opacity-0',
          'md:pointer-events-none md:group-hover/hint:visible md:group-hover/hint:opacity-100 md:group-focus-within/hint:visible md:group-focus-within/hint:opacity-100',
          open && 'visible opacity-100',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="whitespace-pre-wrap">{children}</span>
      </span>
    </span>
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
      apiFetch<{ ok: boolean }>('/extra-lesson/stats/calc', {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId }),
        token: token ?? null,
        signal: ac.signal,
      }).catch(() => {});
      return () => ac.abort();
    }
    if (result.net === 0) lastCountedNetRef.current = 0;
  }, [result.net, sessionId, token]);

  /** Heartbeat – sekme gizliyken atlanır; interval unmount’ta temizlenir */
  useEffect(() => {
    if (!p || !sessionId) return;
    const sendHeartbeat = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      apiFetch<{ ok: boolean }>('/extra-lesson/stats/heartbeat', {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId }),
        token: token ?? null,
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
  }, [p, sessionId, token]);

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
      `  Gelir toplamı: ${formatTL(result.totalBrut)}`,
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

  const buildShareShort = useCallback(() => {
    if (!p) return '';
    const unvanLabel = UNVAN_OPTIONS.find((o) => o.value === unvan)?.label ?? unvan;
    const eduLabel = educationLevels.find((e) => e.key === educationKey)?.label ?? educationKey;
    const dönemLabel = semesterCode
      ? semesters.find((s) => s.semester_code === semesterCode)?.title ?? p.title ?? semesterCode
      : p.title ?? 'Aktif dönem';
    const examN = centralExam.filter(Boolean).length;
    const totalH = inputSummary.totalHourly;
    const kesintiStr =
      result.totalKesinti > 0 ? `\n📉 Kesintiler: −${formatTL(result.totalKesinti)} (GV/DV${result.sgkKesinti > 0 ? '/SGK' : ''})` : '';
    return [
      '📋 Ek ders ücreti · Öğretmen Pro',
      `📅 ${dönemLabel}`,
      `👤 ${unvanLabel} · ${eduLabel}`,
      totalH > 0 || examN > 0 ? `⏱ ${totalH} saat ek ders${examN > 0 ? ` · 📝 ${examN} sınav görevi` : ''}` : null,
      '',
      `💶 Tahmini net: ${formatTL(result.net)}`,
      `📊 Brüt gelir: ${formatTL(result.totalBrut)}${kesintiStr}`,
      '',
      '── Tam döküm aşağıda veya paylaşılan görselde ──',
    ]
      .filter((line): line is string => line != null)
      .join('\n');
  }, [
    p,
    unvan,
    educationKey,
    educationLevels,
    semesterCode,
    semesters,
    result.net,
    result.totalBrut,
    result.totalKesinti,
    result.sgkKesinti,
    centralExam,
    inputSummary.totalHourly,
  ]);

  const resultCardRef = useRef<HTMLDivElement>(null);
  const shareSnapshotRef = useRef<HTMLDivElement>(null);

  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const [shareSheetMounted, setShareSheetMounted] = useState(false);
  const [sharePreviewUrl, setSharePreviewUrl] = useState<string | null>(null);
  useEffect(() => setShareSheetMounted(true), []);

  useEffect(() => {
    if (!shareSheetOpen || !hasInput) {
      setSharePreviewUrl((u) => {
        if (u) URL.revokeObjectURL(u);
        return null;
      });
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      void (async () => {
        const blob = await captureEkDersCardAsPng(resultCardRef.current, shareSnapshotRef.current);
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
  }, [
    shareSheetOpen,
    hasInput,
    result.net,
    result.totalBrut,
    result.totalKesinti,
    result.breakdown.length,
    inputSummary.totalHourly,
  ]);
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
    const title = 'Ek ders ücreti — Öğretmen Pro';
    const short = buildShareShort();
    let blob: Blob | null = null;
    if (typeof window !== 'undefined') {
      blob = await captureEkDersCardAsPng(resultCardRef.current, shareSnapshotRef.current);
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
          const file = new File([blob], 'ek-ders-sonuc.png', { type: 'image/png' });

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

      if (blob && (await tryCopyImage())) {
        return;
      }
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
    try {
      await navigator.clipboard.writeText(`${buildShareShort()}\n\n${textFull}`);
      toast.success('Metin kopyalandı');
      setShareSheetOpen(false);
    } catch {
      toast.error('Kopyalanamadı');
    }
  }, [buildShareText, buildShareShort]);

  const copyShareImageOnly = useCallback(async () => {
    const blob = await captureEkDersCardAsPng(resultCardRef.current, shareSnapshotRef.current);
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
    'w-full min-h-11 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm transition-all placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500 sm:min-h-[44px] sm:rounded-xl sm:px-3.5 sm:py-2.5';
  const labelCls =
    'mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-medium leading-snug text-zinc-500 sm:mb-1.5 sm:text-xs dark:text-zinc-400';
  const settingsLabelCls =
    'mb-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] font-medium leading-snug text-zinc-500 sm:mb-1 sm:gap-x-2 sm:text-xs dark:text-zinc-400';
  const settingsInputCls =
    'w-full min-h-9 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-[13px] transition-all placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500 sm:min-h-10 sm:rounded-lg sm:px-3 sm:py-2 sm:text-sm';

  const semesterBadgeLabel =
    p &&
    (semesterCode ? semesters.find((s) => s.semester_code === semesterCode)?.title ?? p.title : p.title);

  return (
    <div className="relative min-h-screen bg-linear-to-br from-sky-50/40 via-emerald-50/20 to-amber-50/30 dark:from-zinc-950 dark:via-emerald-950/10 dark:to-zinc-950">
      <div
        className="mx-auto max-w-6xl px-3 py-2 pb-6 sm:px-6 sm:py-6 sm:pb-12 lg:px-8"
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        <header
          className={cn(
            'mb-4 flex flex-col gap-2.5 border-b border-zinc-200/80 pb-3 dark:border-zinc-800/80 sm:mb-7 sm:gap-4 sm:pb-5',
            isGuest && 'mb-5 sm:mb-6',
          )}
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-4">
            <div className="min-w-0 max-w-2xl space-y-2 sm:space-y-3">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <Link
                  href="/hesaplamalar"
                  className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-600 transition hover:border-emerald-200 hover:text-emerald-700 sm:px-3 sm:py-1.5 sm:text-xs dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-emerald-900 dark:hover:text-emerald-300"
                >
                  <ArrowLeft className="size-3 sm:size-3.5" />
                  Hesaplamalar
                </Link>
                {semesterBadgeLabel ? (
                  <span className="inline-flex max-w-full items-center truncate rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-medium text-emerald-900 sm:px-3 sm:py-1.5 sm:text-xs dark:bg-emerald-900/40 dark:text-emerald-200">
                    {semesterBadgeLabel}
                  </span>
                ) : null}
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 sm:text-[11px] sm:tracking-[0.14em] dark:text-emerald-400">
                Hesaplama aracı
              </p>
              <div className="flex min-w-0 items-center justify-between gap-2">
                <h1 className="min-w-0 flex-1 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
                  Ek ders ücreti
                </h1>
                <button
                  type="button"
                  onClick={reset}
                  className="group inline-flex shrink-0 items-center justify-center gap-1 rounded-lg border border-amber-200 bg-amber-50/80 px-2 py-1.5 text-[11px] font-medium text-amber-800 transition-all hover:bg-amber-100 active:scale-[0.98] lg:hidden dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                  aria-label="Sıfırla"
                >
                  <RotateCcw className="size-3.5 text-amber-600 transition-transform group-hover:-rotate-180 group-hover:duration-500 dark:text-amber-400" strokeWidth={2} />
                  Sıfırla
                </button>
              </div>
              {p && stats && (
                <dl
                  className={cn(
                    'grid w-full max-w-full gap-1 sm:max-w-xl sm:gap-3',
                    calcCount > 0 ? 'grid-cols-3' : 'grid-cols-2',
                  )}
                >
                  <div className="min-w-0 rounded-md border border-emerald-200/80 bg-white/90 px-1 py-1.5 shadow-sm sm:rounded-xl sm:px-4 sm:py-3 dark:border-emerald-900/40 dark:bg-zinc-900/60">
                    <dt className="text-center text-[7px] font-medium leading-tight text-zinc-500 sm:text-left sm:text-[11px] sm:leading-snug dark:text-zinc-400">
                      Canlı kullanıcı
                    </dt>
                    <dd className="mt-0.5 flex flex-col items-center gap-0 sm:mt-1 sm:items-baseline sm:gap-1 sm:whitespace-nowrap">
                      <span className="text-sm font-bold tabular-nums text-zinc-900 sm:text-xl dark:text-zinc-50">{stats.live_users}</span>
                      <span className="text-[7px] leading-none text-zinc-500 sm:text-[10px] dark:text-zinc-400">şu an</span>
                    </dd>
                  </div>
                  <div className="min-w-0 rounded-md border border-violet-200/80 bg-white/90 px-1 py-1.5 shadow-sm sm:rounded-xl sm:px-4 sm:py-3 dark:border-violet-900/40 dark:bg-zinc-900/60">
                    <dt
                      className="text-center text-[7px] font-medium leading-[1.15] text-zinc-500 sm:text-left sm:text-[11px] sm:leading-snug dark:text-zinc-400"
                      title="Hesaplayan (benzersiz)"
                    >
                      <span className="sm:hidden">Hesaplayan</span>
                      <span className="hidden sm:inline">Hesaplayan (benzersiz)</span>
                    </dt>
                    <dd className="mt-0.5 text-center sm:mt-1 sm:text-left">
                      <span className="text-sm font-bold tabular-nums text-zinc-900 sm:text-xl dark:text-zinc-50">
                        {formatCompact(stats.total_calculations)}
                      </span>
                    </dd>
                  </div>
                  {calcCount > 0 && (
                    <div className="min-w-0 rounded-md border border-fuchsia-200/80 bg-linear-to-br from-fuchsia-50/90 to-violet-50/80 px-1 py-1.5 shadow-sm dark:border-fuchsia-900/40 dark:from-fuchsia-950/30 dark:to-violet-950/25 sm:rounded-xl sm:px-4 sm:py-3">
                      <dt className="flex items-center justify-center gap-0.5 text-[7px] font-medium leading-tight text-zinc-500 sm:justify-start sm:gap-1.5 sm:text-[11px] sm:leading-snug dark:text-zinc-400">
                        <Activity className="hidden size-3 shrink-0 animate-pulse text-fuchsia-600 sm:inline dark:text-fuchsia-400" strokeWidth={2} />
                        Bu oturumda
                      </dt>
                      <dd className="mt-0.5 text-center sm:mt-1 sm:text-left sm:whitespace-nowrap">
                        <span className="text-sm font-bold tabular-nums text-fuchsia-800 sm:text-xl dark:text-fuchsia-200">{calcCount}</span>
                      </dd>
                    </div>
                  )}
                </dl>
              )}
              {p && statsError && (
                <p role="status" className="mt-1 max-w-xl text-[11px] leading-snug text-amber-800 dark:text-amber-200/90">
                  {statsError}
                </p>
              )}
            </div>
            <div
              className={cn(
                'flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap lg:flex lg:flex-col lg:items-stretch',
                !(hasInput && p) && 'max-lg:hidden',
              )}
            >
              {hasInput && p && (
                <>
                  <button
                    type="button"
                    onClick={() => openMobileShareSheet()}
                    className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-500 px-3 py-2 text-xs font-medium text-white shadow-sm transition-all hover:bg-emerald-600 active:scale-[0.98] sm:min-h-[44px] sm:w-auto sm:gap-2 sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-sm dark:border-emerald-600 dark:bg-emerald-600"
                  >
                    <Share2 className="size-3.5 sm:size-4" strokeWidth={2} />
                    Paylaş
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyShareImageOnly()}
                    className="hidden min-h-10 items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800 shadow-sm transition-all hover:bg-zinc-50 active:scale-[0.98] sm:inline-flex sm:min-h-[44px] sm:gap-2 sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700/80"
                    title="Ekrandaki sonuç kartının PNG görüntüsünü panoya kopyalar"
                  >
                    <ImageIcon className="size-3.5 sm:size-4" strokeWidth={2} />
                    Kart görseli
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={reset}
                className="group hidden min-h-10 items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs font-medium text-amber-800 transition-all hover:bg-amber-100 active:scale-[0.98] sm:min-h-[44px] sm:gap-2 sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-sm lg:inline-flex dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
              >
                <RotateCcw className="size-3.5 text-amber-600 transition-transform group-hover:-rotate-180 group-hover:duration-500 sm:size-4 dark:text-amber-400" strokeWidth={2} />
                Sıfırla
              </button>
            </div>
          </div>
        </header>

        {loading && !p && <CalcSkeleton />}

        {!p && !loading && (
          <div className="relative overflow-hidden rounded-xl border border-amber-200/70 bg-amber-50/50 p-5 shadow-sm sm:rounded-2xl sm:p-10 dark:border-amber-900/40 dark:bg-amber-950/20">
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
          <div className="flex min-w-0 flex-col gap-4 sm:gap-6 lg:grid lg:grid-cols-[1fr_360px]">
            <div className="min-w-0 space-y-3 sm:space-y-6 lg:order-1">
              <nav
                className="sticky top-0 z-20 -mx-1 flex gap-1.5 overflow-x-auto overscroll-x-contain rounded-xl border border-zinc-200/80 bg-white/90 px-1.5 py-1.5 shadow-sm backdrop-blur-md scrollbar-none sm:hidden dark:border-zinc-800/80 dark:bg-zinc-950/90"
                aria-label="Veri girişi bölümleri"
              >
                {[
                  { id: 'ek-section-ayarlar', label: 'Ayarlar' },
                  ...(effectiveHourlyLineItems.length > 0 ? [{ id: 'ek-section-saatler', label: 'Saatler' }] : []),
                  ...(p.central_exam_roles && p.central_exam_roles.length > 0 && unvan !== 'meb_ucretli'
                    ? [{ id: 'ek-section-sinav', label: 'Sınav' }]
                    : []),
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className="shrink-0 rounded-lg bg-zinc-100/90 px-3 py-2 text-[11px] font-semibold text-zinc-700 transition active:scale-[0.98] dark:bg-zinc-800/90 dark:text-zinc-200"
                    onClick={() => document.getElementById(tab.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>

              <section
                id="ek-section-ayarlar"
                className="relative scroll-mt-20 overflow-hidden rounded-xl border border-emerald-300/55 bg-white p-2.5 shadow-sm ring-1 ring-emerald-500/10 dark:border-emerald-700/55 dark:bg-zinc-900 dark:ring-emerald-500/15 sm:rounded-2xl sm:border-2 sm:p-5 sm:shadow-md"
              >
                <div className="absolute left-0 top-0 h-full w-1 rounded-l-[10px] bg-linear-to-b from-emerald-500 via-teal-500 to-cyan-500 sm:w-1.5 sm:rounded-l-2xl" />
                <DotPattern />
                <div className="relative mb-2 flex min-w-0 flex-wrap items-center justify-between gap-1.5 sm:mb-5 sm:gap-3">
                  <div className="flex min-w-0 max-w-full flex-1 flex-wrap items-center gap-2">
                    <h2 className="flex min-w-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 sm:gap-2.5 sm:text-sm sm:tracking-widest dark:text-zinc-400">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 sm:size-8 dark:bg-emerald-500/20">
                        <Calculator className="size-[15px] text-emerald-600 sm:size-4 dark:text-emerald-400" strokeWidth={2} />
                      </span>
                      Ayarlar
                    </h2>
                  </div>
                  {p.title && (
                    <span
                      className="min-w-0 max-w-[min(100%,14rem)] shrink truncate rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 sm:px-3 sm:py-1 sm:text-xs dark:bg-emerald-900/40 dark:text-emerald-400"
                      title={p.title}
                    >
                      {p.title}
                    </span>
                  )}
                </div>
                <div className="relative space-y-2 sm:space-y-5">
                  {/* Genel — mobilde tek sütun, sm+ iki sütun */}
                  <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-4">
                    <div className="min-w-0">
                      <label className={`${settingsLabelCls} break-words`}>
                        <Calendar className="size-3 shrink-0 text-sky-500 dark:text-sky-400" />
                        Bütçe dönemi
                      </label>
                      <select
                        value={semesterCode}
                        onChange={(e) => setSemesterCode(e.target.value)}
                        className={`${settingsInputCls} truncate`}
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
                      <label className={`${settingsLabelCls} break-words`}>
                        <GraduationCap className="size-3 shrink-0 text-amber-500 dark:text-amber-400" />
                        Ünvan
                        {(unvan === 'meb_ucretli' || unvan === 'meb_sozlesmeli') && (
                          <span className="group relative ml-1 inline-flex">
                            <Info
                              className="size-3.5 shrink-0 cursor-help text-sky-500 dark:text-sky-400"
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
                        className={settingsInputCls}
                      >
                        {UNVAN_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="min-w-0">
                      <label className={`${settingsLabelCls} break-words`}>
                        <GraduationCap className="size-3 shrink-0 text-amber-500 dark:text-amber-400" />
                        Öğrenim durumu
                      </label>
                      <select value={educationKey} onChange={(e) => setEducationKey(e.target.value)} className={settingsInputCls}>
                        {educationLevels.map((e) => (
                          <option key={e.key} value={e.key}>
                            {e.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="min-w-0">
                      <div className={`${settingsLabelCls} break-words`}>
                        <Percent className="size-3 shrink-0 text-rose-500 dark:text-rose-400" />
                        <span>Vergi dilimi</span>
                        <SectionInfoHint id="ek-ders-vergi-dilimi" label="Vergi dilimi hakkında bilgi" accent="emerald">
                          {FIELD_HINT.vergiDilimi}
                        </SectionInfoHint>
                      </div>
                      <select
                        value={taxRate}
                        onChange={(e) => {
                          setTaxRate(Number(e.target.value));
                          setTaxMatrah('');
                        }}
                        className={settingsInputCls}
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
                    </div>
                  </div>
                  {/* Vergi istisnaları - 2 sütun, daha geniş */}
                  <div className="grid min-w-0 gap-2 sm:gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="min-w-0">
                      <div className={`${settingsLabelCls} break-words`}>
                        <Coins className="size-3 shrink-0 text-amber-500 dark:text-amber-400" />
                        <span>Geçen aylar vergi matrahı (brüt)</span>
                        <SectionInfoHint id="ek-ders-matrah" label="Geçen aylar vergi matrahı hakkında bilgi" accent="emerald">
                          {FIELD_HINT.matrah}
                        </SectionInfoHint>
                      </div>
                      <MatrahStepper
                        value={taxMatrah}
                        onChange={setTaxMatrah}
                        step={100}
                        placeholder="Bu yıl geçen aylar brüt"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className={`${settingsLabelCls} break-words`}>
                        <Coins className="size-3 shrink-0 text-amber-500 dark:text-amber-400" />
                        <span>GV istisna faydalanılan</span>
                        <SectionInfoHint id="ek-ders-gv-istisna" label="GV istisna hakkında bilgi" accent="emerald">
                          {`Maaşta kullanılan vergi tutarı. Üst sınır: ${formatTL(parseNum(p.gv_exemption_max))}.`}
                        </SectionInfoHint>
                      </div>
                      <MoneyNumericStepper
                        value={gvUsed}
                        onChange={setGvUsed}
                        step={10}
                        max={parseNum(p.gv_exemption_max)}
                        placeholder="0"
                      />
                    </div>
                    <div className="min-w-0 sm:col-span-2 lg:col-span-1">
                      <div className={`${settingsLabelCls} break-words`}>
                        <Coins className="size-3 shrink-0 text-amber-500 dark:text-amber-400" />
                        <span>DV istisna matrah faydalanılan</span>
                        <SectionInfoHint id="ek-ders-dv-istisna" label="DV istisna hakkında bilgi" accent="emerald">
                          {`Maaşta kullanılan brüt matrah. Üst sınır: ${formatTL(parseNum(p.dv_exemption_max))}.`}
                        </SectionInfoHint>
                      </div>
                      <MoneyNumericStepper
                        value={dvUsed}
                        onChange={setDvUsed}
                        step={10}
                        max={parseNum(p.dv_exemption_max)}
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
              </section>

              {effectiveHourlyLineItems.length > 0 && (
                <section
                  id="ek-section-saatler"
                  className="min-w-0 scroll-mt-20 overflow-hidden rounded-xl border border-sky-300/60 bg-white shadow-sm ring-1 ring-sky-500/10 dark:border-sky-700/50 dark:bg-zinc-900 dark:ring-sky-500/15 sm:rounded-2xl sm:border-2 sm:shadow-md"
                >
                  <div className="flex w-full items-stretch">
                    <button
                      type="button"
                      onClick={() =>
                        setExpanded((e) => ({ ...e, Ek_ders_saatleri: !(e.Ek_ders_saatleri ?? true) }))
                      }
                      className="flex min-h-11 min-w-0 flex-1 touch-manipulation items-center gap-2 px-3 py-2 text-left transition-colors active:bg-sky-50 sm:min-h-[48px] sm:gap-3 sm:px-6 sm:py-4 sm:hover:bg-sky-50/50 dark:active:bg-sky-950/30 dark:sm:hover:bg-sky-950/20"
                    >
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 sm:size-9 dark:bg-sky-500/25">
                        <BookOpen className="size-[15px] text-sky-600 sm:size-[18px] dark:text-sky-400" strokeWidth={2} />
                      </span>
                      <span className="truncate text-[13px] font-semibold leading-tight text-zinc-900 sm:text-base dark:text-zinc-100">
                        Ek ders saatleri
                      </span>
                    </button>
                    <div className="flex shrink-0 items-center gap-1.5 border-l border-sky-200/40 px-1.5 py-1.5 dark:border-sky-800/40 sm:gap-3 sm:px-3 sm:py-3 sm:pr-4">
                      {effectiveHourlyLineItems.some((li) => (hours[li.key] ?? 0) > 0) && (
                        <span className="hidden rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 min-[380px]:inline dark:bg-emerald-500/25 dark:text-emerald-400 sm:px-3 sm:py-1 sm:text-xs">
                          Dolu
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setExpanded((e) => ({ ...e, Ek_ders_saatleri: !(e.Ek_ders_saatleri ?? true) }))
                        }
                        className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 sm:min-h-[44px] sm:min-w-[44px] dark:hover:bg-zinc-800"
                        aria-label={
                          (expanded.Ek_ders_saatleri ?? true)
                            ? 'Ek ders saatleri bölümünü daralt'
                            : 'Ek ders saatleri bölümünü aç'
                        }
                      >
                        {(expanded.Ek_ders_saatleri ?? true) ? (
                          <ChevronUp className="size-5 text-zinc-500" strokeWidth={2} />
                        ) : (
                          <ChevronDown className="size-5 text-zinc-500" strokeWidth={2} />
                        )}
                      </button>
                    </div>
                  </div>
                  {(expanded.Ek_ders_saatleri ?? true) && (
                    <div className="min-w-0 space-y-3 border-t border-sky-200/50 bg-sky-50/40 p-3 dark:border-sky-900/30 dark:bg-sky-950/20 sm:space-y-5 sm:p-5">
                      {effectiveCentralExam.length > 0 &&
                        !effectiveHourlyLineItems.some((li) => (hours[li.key] ?? 0) > 0) && (
                        <p className="text-[11px] leading-snug text-sky-600 dark:text-sky-500">
                          Merkezi sınav görevine ek olarak gündüz/gece ek dersi de varsa aşağıdaki alanlara saat girin.
                        </p>
                      )}
                      <div className="flex items-start gap-2">
                        <SectionInfoHint id="ek-ders-saat-alanlari" label="Saat girişleri hakkında bilgi" accent="sky">
                          {FIELD_HINT.ekDersSaatleri}
                        </SectionInfoHint>
                      </div>
                      {hourlyGroups.map((group) => (
                        <div key={group.label} className="min-w-0 space-y-1.5 sm:space-y-2">
                          <h3 className="block w-full text-sm font-semibold text-zinc-700 sm:text-base dark:text-zinc-300 [overflow-wrap:anywhere]">
                            {group.label}
                          </h3>
                          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 sm:gap-2">
                            {group.items.map((li) => {
                              const h = hours[li.key] ?? 0;
                              const useNight = li.key === 'gece' || li.key.endsWith('_gece');
                              return (
                                <div
                                  key={li.key}
                                  className={`flex min-h-[44px] flex-row items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 sm:min-h-0 sm:rounded-xl sm:px-3 sm:py-2.5 ${
                                    useNight
                                      ? 'border-indigo-200/60 bg-indigo-50/30 dark:border-indigo-900/40 dark:bg-indigo-950/20'
                                      : 'border-sky-200/45 bg-white dark:border-sky-900/30 dark:bg-zinc-900'
                                  }`}
                                >
                                  <span className="min-w-0 flex-1 text-[13px] font-medium leading-snug text-zinc-800 line-clamp-2 sm:text-sm dark:text-zinc-200">
                                    {li.label}
                                  </span>
                                  <div className="flex shrink-0 flex-col items-end gap-0">
                                    <HourQuantityStepper
                                      hours={h}
                                      onHours={(n) => handleHourChange(li.key, n)}
                                      ariaLabel={`${li.label} saat`}
                                    />
                                    {h > 0 && p && (
                                      <span className="max-w-[9rem] truncate text-[10px] text-emerald-600 sm:text-[11px] dark:text-emerald-400">
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
                <section
                  id="ek-section-sinav"
                  className="scroll-mt-20 overflow-hidden rounded-xl border border-violet-300/60 bg-white shadow-sm ring-1 ring-violet-500/10 dark:border-violet-700/50 dark:bg-zinc-900 dark:ring-violet-500/15 sm:rounded-2xl sm:border-2 sm:shadow-md"
                >
                  <div className="flex w-full items-stretch">
                    <button
                      type="button"
                      onClick={() =>
                        setExpanded((e) => ({ ...e, Merkezi_sinav: !(e.Merkezi_sinav ?? true) }))
                      }
                      className="flex min-h-11 min-w-0 flex-1 touch-manipulation items-center gap-2 px-3 py-2 text-left transition-colors active:bg-violet-50 sm:min-h-[48px] sm:gap-3 sm:px-6 sm:py-4 sm:hover:bg-violet-50/50 dark:active:bg-violet-950/30 dark:sm:hover:bg-violet-950/20"
                    >
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 sm:size-9 dark:bg-violet-500/25">
                        <ClipboardList className="size-[15px] text-violet-600 sm:size-[18px] dark:text-violet-400" strokeWidth={2} />
                      </span>
                      <span className="truncate text-[13px] font-semibold leading-tight text-zinc-900 sm:text-base dark:text-zinc-100">
                        Merkezi sınav görevi
                      </span>
                    </button>
                    <div className="flex shrink-0 items-center gap-1.5 border-l border-violet-200/40 px-1.5 py-1.5 dark:border-violet-800/40 sm:gap-3 sm:px-3 sm:py-3 sm:pr-4">
                      {centralExam.some(Boolean) && (
                        <span className="hidden rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 min-[380px]:inline dark:bg-emerald-500/25 dark:text-emerald-400 sm:px-3 sm:py-1 sm:text-xs">
                          Seçili
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setExpanded((e) => ({ ...e, Merkezi_sinav: !(e.Merkezi_sinav ?? true) }))
                        }
                        className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 sm:min-h-[44px] sm:min-w-[44px] dark:hover:bg-zinc-800"
                        aria-label={
                          (expanded.Merkezi_sinav ?? true)
                            ? 'Merkezi sınav bölümünü daralt'
                            : 'Merkezi sınav bölümünü aç'
                        }
                      >
                        {(expanded.Merkezi_sinav ?? true) ? (
                          <ChevronUp className="size-5 text-zinc-500" strokeWidth={2} />
                        ) : (
                          <ChevronDown className="size-5 text-zinc-500" strokeWidth={2} />
                        )}
                      </button>
                    </div>
                  </div>
                  {(expanded.Merkezi_sinav ?? true) && (
                    <div className="grid gap-2 border-t border-violet-200/50 bg-violet-50/40 p-3 dark:border-violet-900/30 dark:bg-violet-950/20 sm:grid-cols-2 sm:gap-3 sm:p-5">
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
                className="relative overflow-hidden rounded-t-2xl border-2 border-b-0 border-emerald-300/80 bg-white shadow-[0_-8px_32px_-8px_rgba(16,185,129,0.2)] dark:border-emerald-700/55 dark:bg-zinc-900 sm:rounded-t-3xl lg:rounded-2xl lg:border-b lg:border-emerald-300/70 lg:shadow-xl"
              >
                <div
                  className="absolute inset-0 bg-linear-to-br from-emerald-500/10 via-teal-500/5 to-cyan-500/5"
                  data-html2canvas-ignore
                />
                <DotPattern excludeFromScreenshot />
                <div className="relative p-4 pb-6 sm:p-6 sm:pb-6" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
                  <div className="mb-3 flex justify-center lg:hidden">
                    <span className="h-1 w-10 rounded-full bg-emerald-300/60 dark:bg-emerald-600/50" aria-hidden="true" />
                  </div>
                  <div className="mb-4 flex flex-wrap items-center gap-2 sm:mb-5 sm:gap-2.5">
                    <h2 className="flex min-w-0 flex-1 items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 sm:text-xs sm:tracking-widest dark:text-zinc-400">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 sm:size-8 dark:bg-emerald-500/20">
                        <Receipt className="size-3.5 text-emerald-600 sm:size-4 dark:text-emerald-400" strokeWidth={2} />
                      </span>
                      Sonuç
                    </h2>
                  </div>
                  {!hasInput ? (
                    <div className="flex flex-col items-center py-10 text-center sm:py-12">
                      <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-zinc-100 sm:mb-4 sm:size-14 sm:rounded-2xl dark:bg-zinc-800">
                        <Calculator className="size-6 text-zinc-400 sm:size-7 dark:text-zinc-500" strokeWidth={1.5} />
                      </div>
                      <p className="max-w-[16rem] text-xs leading-relaxed text-zinc-500 sm:text-sm dark:text-zinc-400">
                        Saat girin veya merkezi sınav seçin, hesaplama anında görünür.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="mb-4 rounded-xl bg-linear-to-br from-emerald-500 via-teal-600 to-cyan-600 p-4 text-white shadow-lg shadow-emerald-500/20 sm:mb-6 sm:rounded-2xl sm:p-6">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-emerald-100/90 sm:text-xs sm:tracking-widest">
                          Brütten hesaplanan net tutar
                        </p>
                        <p className="mt-2 text-3xl font-bold leading-none tabular-nums sm:mt-3 sm:text-4xl">
                          {formatTL(result.net)}
                        </p>
                        <p className="mt-2 text-[10px] leading-snug text-emerald-100/88 sm:text-[11px]">
                          Tahmini net ücret
                          {result.sgkKesinti > 0 ? ' (GV, DV ve Sigorta primi düşülmüş)' : ' (GV ve DV kesintileri düşülmüş)'}
                        </p>
                      </div>

                      {(inputSummary.hourLines.length > 0 || inputSummary.examSlots.length > 0) && (
                        <div className="mb-4 rounded-lg border border-emerald-200/70 bg-emerald-50/40 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20 sm:mb-5 sm:rounded-xl sm:p-4">
                          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-800 sm:mb-2.5 sm:text-xs dark:text-emerald-300">
                            Hesaplanan girdiler
                          </p>
                          {inputSummary.hourLines.length > 0 && (
                            <ul className="mb-2 space-y-1 text-[11px] text-zinc-700 sm:text-xs dark:text-zinc-300">
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
                            <ul className="space-y-1 border-t border-emerald-200/50 pt-2 text-[11px] text-zinc-700 dark:border-emerald-900/40 sm:text-xs dark:text-zinc-300">
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

                      <dl className="space-y-1.5 text-xs sm:space-y-2 sm:text-sm">
                        <div className="flex justify-between gap-2 rounded-lg bg-zinc-50 px-2.5 py-2 sm:px-3 sm:py-2.5 dark:bg-zinc-800/50">
                          <dt className="text-zinc-600 dark:text-zinc-400">Gelir toplamı</dt>
                          <dd className="shrink-0 font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{formatTL(result.totalBrut)}</dd>
                        </div>
                        <div className="flex justify-between gap-2 rounded-lg bg-red-50 px-2.5 py-2 sm:px-3 sm:py-2.5 dark:bg-red-950/30">
                          <dt className="text-red-700 dark:text-red-400">Gelir vergisi</dt>
                          <dd className="shrink-0 tabular-nums font-medium text-red-700 dark:text-red-400">−{formatTL(result.gvKesinti)}</dd>
                        </div>
                        <div className="flex justify-between gap-2 rounded-lg bg-red-50 px-2.5 py-2 sm:px-3 sm:py-2.5 dark:bg-red-950/30">
                          <dt className="text-red-700 dark:text-red-400">Damga vergisi</dt>
                          <dd className="shrink-0 tabular-nums font-medium text-red-700 dark:text-red-400">−{formatTL(result.dvKesinti)}</dd>
                        </div>
                        {result.sgkKesinti > 0 && (
                          <div className="flex justify-between gap-2 rounded-lg bg-red-50 px-2.5 py-2 sm:px-3 sm:py-2.5 dark:bg-red-950/30">
                            <dt className="text-red-700 dark:text-red-400">Sigorta primi</dt>
                            <dd className="shrink-0 tabular-nums font-medium text-red-700 dark:text-red-400">−{formatTL(result.sgkKesinti)}</dd>
                          </div>
                        )}
                        {result.totalKesinti > 0 && (
                          <div className="flex justify-between gap-2 rounded-lg border border-red-200/80 bg-red-50/90 px-2.5 py-2 sm:px-3 sm:py-2.5 dark:border-red-900/50 dark:bg-red-950/40">
                            <dt className="font-medium text-red-800 dark:text-red-300">Kesinti toplamı</dt>
                            <dd className="shrink-0 tabular-nums font-semibold text-red-800 dark:text-red-300">−{formatTL(result.totalKesinti)}</dd>
                          </div>
                        )}
                      </dl>

                      <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-800/30 sm:mt-5 sm:rounded-xl sm:p-4">
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-600 sm:mb-3 sm:text-xs dark:text-zinc-500">
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
                  <p className="mt-3 text-[9px] leading-relaxed text-zinc-400 sm:mt-4 sm:text-[10px] dark:text-zinc-500">
                    Girdiler brüt tutarlar üzerinden; hesaplama brütten yapılır, sonuç net gösterilir. Bilgilendirme amaçlıdır. Kesin tutar için kurumunuza danışın.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>

      {hasInput && p ? (
        <div
          ref={shareSnapshotRef}
          className="pointer-events-none fixed left-[-9999px] top-0 z-0 box-border w-[380px] overflow-hidden rounded-2xl border border-emerald-200 bg-white text-zinc-900 shadow-2xl"
          style={{ fontFamily: 'system-ui, "Segoe UI", sans-serif' }}
          aria-hidden
        >
          <div
            className="px-4 py-3 text-white"
            style={{ background: 'linear-gradient(90deg, #059669 0%, #0d9488 100%)' }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-100">Ek ders hesaplama</p>
                <p className="mt-0.5 truncate text-[13px] font-bold leading-tight">
                  {semesterCode
                    ? semesters.find((s) => s.semester_code === semesterCode)?.title ?? p.title ?? semesterCode
                    : p.title ?? 'Aktif dönem'}
                </p>
              </div>
              <div className="shrink-0 rounded-xl bg-white/20 px-2.5 py-1.5 text-center backdrop-blur-sm">
                <p className="text-[8px] font-medium uppercase text-emerald-100">Öğretmen</p>
                <p className="text-[11px] font-bold leading-none">Pro</p>
              </div>
            </div>
          </div>

          <div className="px-4 pt-4">
            <div
              className="rounded-2xl p-4 text-center text-white shadow-lg"
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #0d9488 50%, #06b6d4 100%)',
              }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/90">Tahmini net ücret</p>
              <p className="mt-2 text-[36px] font-bold leading-none tabular-nums tracking-tight">{formatTL(result.net)}</p>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-emerald-50 px-1.5 py-2 text-center">
                <p className="text-[8px] font-semibold uppercase text-emerald-700">Net</p>
                <p className="mt-1 text-[10px] font-bold tabular-nums text-emerald-900">{formatTL(result.net)}</p>
              </div>
              <div className="rounded-xl bg-sky-50 px-1.5 py-2 text-center">
                <p className="text-[8px] font-semibold uppercase text-sky-700">Brüt</p>
                <p className="mt-1 text-[10px] font-bold tabular-nums text-sky-900">{formatTL(result.totalBrut)}</p>
              </div>
              <div className="rounded-xl bg-rose-50 px-1.5 py-2 text-center">
                <p className="text-[8px] font-semibold uppercase text-rose-700">Kesinti</p>
                <p className="mt-1 text-[10px] font-bold tabular-nums text-rose-900">−{formatTL(result.totalKesinti)}</p>
              </div>
            </div>

            {(inputSummary.totalHourly > 0 || centralExam.some(Boolean)) && (
              <p className="mt-3 rounded-lg bg-zinc-100 px-3 py-2 text-center text-[11px] font-medium text-zinc-700">
                {inputSummary.totalHourly > 0 ? `⏱ ${inputSummary.totalHourly} saat ek ders` : ''}
                {inputSummary.totalHourly > 0 && centralExam.some(Boolean) ? ' · ' : ''}
                {centralExam.some(Boolean) ? `📝 ${centralExam.filter(Boolean).length} sınav görevi` : ''}
              </p>
            )}

            <div className="mt-3 space-y-1.5 border-t border-zinc-100 pt-3 text-[11px]">
              <div className="flex justify-between gap-2">
                <span className="text-zinc-500">Ünvan</span>
                <span className="min-w-0 text-right font-semibold text-zinc-800">
                  {UNVAN_OPTIONS.find((o) => o.value === unvan)?.label ?? unvan}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-zinc-500">Öğrenim</span>
                <span className="min-w-0 text-right font-semibold text-zinc-800">
                  {educationLevels.find((e) => e.key === educationKey)?.label ?? educationKey}
                </span>
              </div>
            </div>

            <div className="mt-3 grid gap-1 rounded-xl bg-zinc-50 p-2.5 text-[11px]">
              <div className="flex justify-between gap-2 text-red-700">
                <span className="font-medium">Gelir vergisi</span>
                <span className="shrink-0 font-semibold tabular-nums">−{formatTL(result.gvKesinti)}</span>
              </div>
              <div className="flex justify-between gap-2 text-red-700">
                <span className="font-medium">Damga vergisi</span>
                <span className="shrink-0 font-semibold tabular-nums">−{formatTL(result.dvKesinti)}</span>
              </div>
              {result.sgkKesinti > 0 ? (
                <div className="flex justify-between gap-2 text-red-700">
                  <span className="font-medium">Sigorta</span>
                  <span className="shrink-0 font-semibold tabular-nums">−{formatTL(result.sgkKesinti)}</span>
                </div>
              ) : null}
            </div>

            <p className="mt-3 pb-4 text-center text-[8px] leading-snug text-zinc-400">
              Bilgilendirme amaçlıdır. Kesin tutar için kurumunuza danışın.
            </p>
          </div>
        </div>
      ) : null}

      {shareSheetMounted && hasInput && p && shareSheetOpen
        ? createPortal(
            <div className="fixed inset-0 z-[100] sm:hidden">
              <button
                type="button"
                className="absolute inset-0 bg-zinc-900/50 backdrop-blur-[2px]"
                aria-label="Kapat"
                onClick={() => setShareSheetOpen(false)}
              />
              <div
                className="absolute bottom-0 left-0 right-0 max-h-[90vh] overflow-y-auto rounded-t-3xl border border-zinc-200/90 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
                style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="ek-share-sheet-title"
              >
                <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                <div className="px-5 pt-2 pb-4">
                  <h2 id="ek-share-sheet-title" className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                    Paylaş
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                    Aşağıdaki görsel, ekrandaki sonuç kartının PNG kopyasıdır. Paylaşımda bu görsel ve kısa özet gider; tam metin için ayrı düğmeyi kullanın.
                  </p>
                  {sharePreviewUrl ? (
                    // blob: URL — next/image uygun değil
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={sharePreviewUrl}
                      alt="Ek ders sonuç kartı önizlemesi"
                      className="mt-4 w-full rounded-2xl border border-zinc-200 object-top shadow-md dark:border-zinc-600"
                    />
                  ) : (
                    <div className="mt-4 flex min-h-[200px] items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 text-xs text-zinc-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                      Önizleme hazırlanıyor…
                    </div>
                  )}
                  <ul className="mt-4 space-y-2 text-[13px] text-zinc-600 dark:text-zinc-400">
                    <li className="flex gap-2">
                      <span className="shrink-0 font-semibold text-emerald-600 dark:text-emerald-400">✓</span>
                      <span>Sonuç kartı PNG (WhatsApp vb. ile görsel paylaşım)</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="shrink-0 font-semibold text-emerald-600 dark:text-emerald-400">✓</span>
                      <span>Kısa özet metin + isteğe bağlı tam döküm</span>
                    </li>
                  </ul>
                  <button
                    type="button"
                    className="mt-5 flex w-full min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-base font-semibold text-white shadow-lg shadow-emerald-500/20 active:scale-[0.99] dark:bg-emerald-600"
                    onClick={() => {
                      void performShare().finally(() => setShareSheetOpen(false));
                    }}
                  >
                    <Share2 className="size-5" strokeWidth={2} />
                    Paylaşımı aç
                  </button>
                  <button
                    type="button"
                    className="mt-2 flex w-full min-h-11 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 py-3 text-sm font-medium text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                    onClick={() => void copyShareImageOnly()}
                  >
                    <ImageIcon className="size-4" strokeWidth={2} />
                    Sadece kart görselini kopyala
                  </button>
                  <button
                    type="button"
                    className="mt-2 flex w-full min-h-11 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 py-3 text-sm font-medium text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                    onClick={() => void copyShareText()}
                  >
                    <Copy className="size-4" strokeWidth={2} />
                    Tüm metni kopyala
                  </button>
                  <button
                    type="button"
                    className="mt-1 w-full py-3 text-sm text-zinc-500 dark:text-zinc-400"
                    onClick={() => setShareSheetOpen(false)}
                  >
                    Vazgeç
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
