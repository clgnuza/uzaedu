'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type HTMLAttributes,
} from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Card, CardContent } from '@/components/ui/card';
import {
  Sparkles,
  RotateCcw,
  Save,
  LayoutDashboard,
  Smartphone,
  CalendarDays,
  ListTree,
  CalendarClock,
  CheckCircle2,
  CircleSlash,
  Download,
  Upload,
  AlertTriangle,
} from 'lucide-react';
import { WELCOME_TODAY_API_PATH } from '@/lib/welcome-public';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { WelcomeMessageDisplay } from '@/components/web-settings/welcome-message-display';
import { WelcomeMessageToolbar } from '@/components/web-settings/welcome-message-toolbar';

export type WelcomeModuleConfig = {
  enabled: boolean;
  by_day: Record<string, string>;
  fallback_message: string | null;
  cache_ttl_welcome: number;
};

const MONTH_NAMES = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
];

/** Hafta Pazartesi ile başlar: Pt … Pa */
const WEEKDAYS_TR = [
  { short: 'Pt', long: 'Pazartesi' },
  { short: 'Sa', long: 'Salı' },
  { short: 'Ça', long: 'Çarşamba' },
  { short: 'Pe', long: 'Perşembe' },
  { short: 'Cu', long: 'Cuma' },
  { short: 'Ct', long: 'Cumartesi' },
  { short: 'Pa', long: 'Pazar' },
] as const;

/** Takvimde geçerli gün sayısı (şubat 29 dahil). */
const YEAR_DAY_TOTAL = 366;

function daysInMonth(month1: number, year: number): number {
  return new Date(year, month1, 0).getDate();
}

function mmdd(month1: number, day: number): string {
  return `${String(month1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function istanbulYmd(): { y: string; m: number; d: number; key: string } {
  const s = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const [y, mo, da] = s.split('-');
  const m = parseInt(mo, 10);
  const d = parseInt(da, 10);
  return { y, m, d, key: mmdd(m, d) };
}

/** Ayın 1. günü için Pazartesi başlı ızgarada sol boş hücre sayısı (0–6). */
function mondayFirstOffset(month1: number, year: number): number {
  const d = new Date(year, month1 - 1, 1);
  const sun = d.getDay();
  return (sun + 6) % 7;
}

function countFilledInMonth(byDay: Record<string, string>, month1: number, year: number): number {
  const max = daysInMonth(month1, year);
  let n = 0;
  for (let d = 1; d <= max; d++) {
    const k = mmdd(month1, d);
    if (byDay[k]?.trim()) n++;
  }
  return n;
}

function serializeWelcomeState(p: {
  enabled: boolean;
  fallback: string;
  cacheTtl: number;
  byDay: Record<string, string>;
}): string {
  const by: Record<string, string> = {};
  for (const [k, v] of Object.entries(p.byDay)) {
    const t = (v ?? '').trim();
    if (t) by[k] = t;
  }
  const norm: Record<string, string> = {};
  for (const k of Object.keys(by).sort()) norm[k] = by[k];
  return JSON.stringify({
    enabled: p.enabled,
    fallback: (p.fallback ?? '').trim(),
    cacheTtl: p.cacheTtl,
    by_day: norm,
  });
}

function parseWelcomeCsv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const idx = t.indexOf(';');
    if (idx === -1) continue;
    const key = t.slice(0, idx).trim();
    const msg = t.slice(idx + 1).trim();
    if (/^\d{2}-\d{2}$/.test(key)) out[key] = msg;
  }
  return out;
}

function downloadTextFile(filename: string, content: string, mime: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: mime }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

type ViewMode = 'calendar' | 'year';

export function WelcomeModulePanel() {
  const { token, me } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [fallback, setFallback] = useState('');
  const [cacheTtl, setCacheTtl] = useState(120);
  const [byDay, setByDay] = useState<Record<string, string>>({});
  const [month, setMonth] = useState(() => istanbulYmd().m);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [dayDraft, setDayDraft] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [savedSig, setSavedSig] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const dayMsgRef = useRef<HTMLTextAreaElement>(null);
  const fallbackMsgRef = useRef<HTMLTextAreaElement>(null);
  const prevLoading = useRef(true);

  const fetchConfig = useCallback(async () => {
    if (!token || me?.role !== 'superadmin') return;
    setLoading(true);
    try {
      const data = await apiFetch<WelcomeModuleConfig>('/app-config/welcome-module', { token });
      setEnabled(!!data.enabled);
      setFallback(data.fallback_message ?? '');
      setCacheTtl(data.cache_ttl_welcome ?? 120);
      setByDay(data.by_day && typeof data.by_day === 'object' ? { ...data.by_day } : {});
    } catch {
      toast.error('Yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [token, me?.role]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  /** Backend `getWelcomeTodayPublic` ile aynı — taslak + Kaydet öncesi üst önizleme ile senkron. */
  const todayPublicPreview = useMemo(() => {
    const date_key = istanbulYmd().key;
    if (!enabled) return { date_key, message: null as string | null };
    const dayMsg = byDay[date_key]?.trim();
    const fb = fallback.trim();
    const message = (dayMsg || fb || null) as string | null;
    return { date_key, message };
  }, [enabled, byDay, fallback]);

  useEffect(() => {
    if (prevLoading.current && !loading) {
      setSavedSig(serializeWelcomeState({ enabled, fallback, cacheTtl, byDay }));
    }
    prevLoading.current = loading;
  }, [loading, enabled, fallback, cacheTtl, byDay]);

  const isDirty = useMemo(() => {
    if (savedSig === null) return false;
    return serializeWelcomeState({ enabled, fallback, cacheTtl, byDay }) !== savedSig;
  }, [savedSig, enabled, fallback, cacheTtl, byDay]);

  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  const filledTotal = useMemo(
    () => Object.keys(byDay).filter((k) => byDay[k]?.trim()).length,
    [byDay],
  );

  const istNow = istanbulYmd();
  const calendarYear = parseInt(istNow.y, 10);

  const calendarCells = useMemo(() => {
    const pad = mondayFirstOffset(month, calendarYear);
    const maxD = daysInMonth(month, calendarYear);
    const cells: ({ kind: 'empty' } | { kind: 'day'; n: number })[] = [];
    for (let i = 0; i < pad; i++) cells.push({ kind: 'empty' });
    for (let d = 1; d <= maxD; d++) cells.push({ kind: 'day', n: d });
    while (cells.length % 7 !== 0) cells.push({ kind: 'empty' });
    return cells;
  }, [month, calendarYear]);

  const selectedKey =
    selectedDay != null && month >= 1 && month <= 12 ? mmdd(month, selectedDay) : null;

  useEffect(() => {
    if (!selectedKey) {
      setDayDraft('');
      return;
    }
    setDayDraft(byDay[selectedKey] ?? '');
  }, [selectedKey, byDay]);

  const handleSaveAll = async () => {
    if (!token || me?.role !== 'superadmin') return;
    setSaving(true);
    try {
      await apiFetch('/app-config/welcome-module', {
        method: 'PATCH',
        token,
        body: JSON.stringify({
          enabled,
          fallback_message: fallback.trim() || null,
          cache_ttl_welcome: cacheTtl,
          by_day: byDay,
        }),
      });
      toast.success('Kaydedildi');
      fetchConfig();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const setDayMessage = (key: string, text: string) => {
    setByDay((prev) => {
      const next = { ...prev };
      const t = text.trim();
      if (!t) delete next[key];
      else next[key] = t;
      return next;
    });
  };

  const goToToday = () => {
    const { m, d } = istanbulYmd();
    setMonth(m);
    setSelectedDay(d);
    setViewMode('calendar');
  };

  const exportJson = () => {
    const payload = {
      version: 1,
      exported_at: new Date().toISOString(),
      enabled,
      fallback_message: fallback.trim() || null,
      cache_ttl_welcome: cacheTtl,
      by_day: Object.fromEntries(
        Object.entries(byDay)
          .filter(([, v]) => v?.trim())
          .sort(([a], [b]) => a.localeCompare(b)),
      ),
    };
    downloadTextFile(
      `hosgeldin-mesajlari-${calendarYear}.json`,
      JSON.stringify(payload, null, 2),
      'application/json',
    );
    toast.success('JSON indirildi');
  };

  const exportCsv = () => {
    const lines = ['MM-DD;mesaj', '# Her satır: 01-15;Metin (noktalı virgül ayırıcı)'];
    for (const k of Object.keys(byDay).sort()) {
      const v = byDay[k]?.trim();
      if (!v) continue;
      const safe = v.replace(/\r?\n/g, ' ').replace(/;/g, '·');
      lines.push(`${k};${safe}`);
    }
    downloadTextFile(`hosgeldin-mesajlari-${calendarYear}.csv`, lines.join('\n'), 'text/csv;charset=utf-8');
    toast.success('CSV indirildi');
  };

  const onImportFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? '');
        if (file.name.endsWith('.json') || text.trim().startsWith('{')) {
          const j = JSON.parse(text) as { by_day?: Record<string, string> };
          const incoming = j.by_day;
          if (!incoming || typeof incoming !== 'object') {
            toast.error('JSON içinde by_day yok');
            return;
          }
          setByDay((prev) => {
            const next = { ...prev };
            for (const [k, v] of Object.entries(incoming)) {
              if (!/^\d{2}-\d{2}$/.test(k)) continue;
              const t = String(v ?? '').trim();
              if (t) next[k] = t;
              else delete next[k];
            }
            return next;
          });
          toast.success('JSON birleştirildi');
        } else {
          const parsed = parseWelcomeCsv(text);
          const n = Object.keys(parsed).length;
          if (n === 0) {
            toast.error('CSV satırı bulunamadı (MM-DD;mesaj)');
            return;
          }
          setByDay((prev) => ({ ...prev, ...parsed }));
          toast.success(`${n} gün içe aktarıldı`);
        }
      } catch {
        toast.error('Dosya okunamadı');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  useEffect(() => {
    if (viewMode !== 'calendar' || selectedDay === null) return;
    const onKey = (ev: KeyboardEvent) => {
      const t = ev.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const maxD = daysInMonth(month, calendarYear);
      let d = selectedDay;
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') {
        ev.preventDefault();
        d = Math.min(maxD, d + 1);
        setSelectedDay(d);
      } else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        d = Math.max(1, d - 1);
        setSelectedDay(d);
      } else if (ev.key === 'Home') {
        ev.preventDefault();
        setSelectedDay(1);
      } else if (ev.key === 'End') {
        ev.preventDefault();
        setSelectedDay(maxD);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewMode, selectedDay, month, calendarYear]);

  if (me?.role !== 'superadmin') return null;

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  const fillPct = Math.min(100, Math.round((filledTotal / YEAR_DAY_TOTAL) * 100));
  const todayIst = istNow;

  return (
    <div className="space-y-8">
      <header className="relative overflow-hidden rounded-3xl border border-violet-500/15 bg-linear-to-br from-violet-500/10 via-fuchsia-500/5 to-amber-500/10 p-6 shadow-sm sm:p-8">
        <div
          className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-violet-400/15 blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-600 shadow-inner ring-1 ring-violet-500/20 dark:text-violet-300">
              <Sparkles className="size-7" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-600/90 dark:text-violet-400/90">
                Sistem
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                Hoşgeldin mesajları
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                Yıllık takvim: her güne (MM-DD) bir kısa metin. Türkiye saati ile eşleşir.
              </p>
              <ul className="mt-4 flex flex-col gap-2.5 text-xs text-muted-foreground sm:text-sm">
                <li className="flex items-start gap-2.5 rounded-xl border border-border/40 bg-background/50 px-3 py-2.5">
                  <LayoutDashboard className="mt-0.5 size-4 shrink-0 text-violet-600 dark:text-violet-400" />
                  <span>
                    <strong className="font-medium text-foreground">Web — öğretmen & okul yöneticisi:</strong> giriş
                    sonrası <strong className="text-foreground">Ana sayfa (Dashboard)</strong> üst bölümünde modern
                    kart olarak gösterilir.
                  </span>
                </li>
                <li className="flex items-start gap-2.5 rounded-xl border border-border/40 bg-background/50 px-3 py-2.5">
                  <Smartphone className="mt-0.5 size-4 shrink-0 text-violet-600 dark:text-violet-400" />
                  <span>
                    <strong className="font-medium text-foreground">Mobil uygulama:</strong> uygulama açılışında veya ana
                    ekranda aynı metin için kamu API{' '}
                    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
                      GET …/api/{WELCOME_TODAY_API_PATH}
                    </code>{' '}
                    çağrılır (token gerekmez).
                  </span>
                </li>
              </ul>
            </div>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            {isDirty && (
              <div className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
                <AlertTriangle className="size-3.5 shrink-0" />
                Kaydedilmemiş değişiklik var — sayfadan çıkmadan <strong>Kaydet</strong>.
              </div>
            )}
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl border-border/60 bg-background/80"
                onClick={() => fetchConfig()}
              >
                <RotateCcw className="mr-1.5 size-3.5" />
                Sıfırla
              </Button>
              <Button
                type="button"
                size="sm"
                className="rounded-xl bg-violet-600 text-white shadow-md shadow-violet-500/10 hover:bg-violet-600/90"
                onClick={handleSaveAll}
                disabled={saving}
              >
                <Save className="mr-1.5 size-3.5" />
                {saving ? 'Kaydediliyor…' : 'Kaydet'}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div
        className={cn(
          'flex flex-col gap-3 rounded-2xl border-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between',
          enabled
            ? 'border-emerald-500/45 bg-emerald-500/[0.08] dark:bg-emerald-950/25'
            : 'border-amber-500/50 bg-amber-500/[0.09] dark:bg-amber-950/20',
        )}
        role="status"
        aria-live="polite"
      >
        <div className="flex flex-wrap items-center gap-3">
          {enabled ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm">
              <CheckCircle2 className="size-3.5" aria-hidden />
              Modül açık
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-600 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm">
              <CircleSlash className="size-3.5" aria-hidden />
              Modül kapalı
            </span>
          )}
          <p className="text-sm leading-snug text-foreground">
            {enabled ? (
              <>
                Öğretmen ve okul yöneticisi <strong>dashboard</strong> ile mobilde mesajlar yayında. Gün metinleri
                aşağıdan; <strong>Kaydet</strong> ile kalıcı olur.
              </>
            ) : (
              <>
                Kullanıcılara <strong>hiçbir</strong> hoşgeldin mesajı gösterilmez. Günleri yine doldurabilirsiniz;
                yayın için modülü <strong>açıp Kaydet</strong> deyin.
              </>
            )}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="border-border/50 bg-card/80 shadow-sm backdrop-blur-sm lg:col-span-2">
          <CardContent className="space-y-6 p-6">
            <div
              className={cn(
                'rounded-2xl border-2 px-4 py-4',
                enabled ? 'border-emerald-500/35 bg-emerald-500/5' : 'border-border bg-muted/30',
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold tracking-tight">Modül yayını</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Kapalı = API mesaj döndürmez. Açık = günlük / varsayılan metin kullanıcıya gider.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  aria-label={enabled ? 'Modülü kapat' : 'Modülü aç'}
                  onClick={() => setEnabled(!enabled)}
                  className={cn(
                    'relative inline-flex h-9 w-[3.75rem] shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                    enabled
                      ? 'bg-emerald-600 focus-visible:ring-emerald-500/50'
                      : 'bg-muted-foreground/30 focus-visible:ring-amber-500/40',
                  )}
                >
                  <span
                    className={cn(
                      'pointer-events-none absolute top-1 left-1 size-7 rounded-full bg-white shadow-md transition-transform',
                      enabled ? 'translate-x-6' : 'translate-x-0',
                    )}
                  />
                </button>
              </div>
              <p className="mt-3 text-[11px] font-medium text-muted-foreground">
                Durum:{' '}
                <span className={enabled ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}>
                  {enabled ? 'Yayın AÇIK' : 'Yayın KAPALI'}
                </span>
              </p>
            </div>

            <div className="rounded-2xl border border-violet-500/15 bg-linear-to-br from-violet-500/5 to-transparent p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-700/90 dark:text-violet-400/90">
                Yıllık doluluk
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-semibold tabular-nums text-foreground">{filledTotal}</span>
                <span className="text-sm text-muted-foreground">/ {YEAR_DAY_TOTAL} gün</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-linear-to-r from-violet-600 to-fuchsia-500 transition-[width]"
                  style={{ width: `${fillPct}%` }}
                />
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Her takvim günü için ayrı kayıt (29 Şubat dahil). Boş günlerde varsayılan mesaj kullanılır.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-[13px] font-medium text-foreground/90" htmlFor="welcome-cache">
                Önbellek (sn)
              </label>
              <Input
                id="welcome-cache"
                type="number"
                min={10}
                max={86400}
                className="h-9 rounded-xl border-border/60"
                value={cacheTtl}
                onChange={(e) => setCacheTtl(parseInt(e.target.value, 10) || 120)}
              />
              <p className="text-[11px] text-muted-foreground">Kamu API yanıtı için Cache-Control</p>
            </div>

            <div className="space-y-2">
              <label className="text-[13px] font-medium text-foreground/90" htmlFor="welcome-fallback">
                Varsayılan mesaj
              </label>
              <WelcomeMessageToolbar
                value={fallback}
                onChange={setFallback}
                textareaRef={fallbackMsgRef}
              />
              <textarea
                ref={fallbackMsgRef}
                id="welcome-fallback"
                className="min-h-[88px] w-full resize-y rounded-xl border border-border/60 bg-background px-3 py-2.5 text-sm shadow-sm transition-colors placeholder:text-muted-foreground/60 focus-visible:border-violet-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/20"
                rows={3}
                value={fallback}
                onChange={(e) => setFallback(e.target.value)}
                placeholder="O güne özel metin yoksa bu gösterilir (**kalın**, _italik_, emoji)."
              />
            </div>

            <div className="space-y-2 rounded-2xl border border-border/50 bg-muted/20 p-4">
              <p className="text-[13px] font-medium text-foreground/90">İçe / dışa aktar</p>
              <p className="text-[11px] text-muted-foreground">
                CSV: satır başına <code className="rounded bg-muted px-1">MM-DD;mesaj</code> · JSON: dışa aktarılan şema
                ile aynı.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={exportJson}>
                  <Download className="mr-1.5 size-3.5" />
                  JSON
                </Button>
                <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={exportCsv}>
                  <Download className="mr-1.5 size-3.5" />
                  CSV
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => importInputRef.current?.click()}
                >
                  <Upload className="mr-1.5 size-3.5" />
                  İçe aktar
                </Button>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".json,.csv,text/plain"
                  className="sr-only"
                  onChange={onImportFile}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className={cn(
            'border-border/50 bg-card/80 shadow-sm backdrop-blur-sm lg:col-span-3',
            !enabled && 'opacity-[0.97]',
          )}
        >
          <CardContent className="space-y-4 p-6">
            {!enabled && (
              <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
                Modül kapalıyken burada girdiğiniz <strong>günlük metinler</strong> kaydedilir; kullanıcılar göremez.
                Yayına almak için modülü açıp <strong>Kaydet</strong> kullanın.
              </div>
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold tracking-tight">Günlük mesaj verisi</h2>
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">**kalın**</strong>, <strong className="text-foreground">_italik_</strong>,
                  emoji; yeni satır desteklenir. Son adım: <strong className="text-foreground">Kaydet</strong>.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex rounded-xl border border-border/50 bg-muted/30 p-0.5">
                  <button
                    type="button"
                    onClick={() => setViewMode('calendar')}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                      viewMode === 'calendar'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <CalendarDays className="size-3.5" />
                    Ay takvimi
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('year')}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                      viewMode === 'year'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <ListTree className="size-3.5" />
                    Yıllık liste
                  </button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  onClick={goToToday}
                >
                  <CalendarClock className="mr-1.5 size-3.5" />
                  Bugüne git
                </Button>
              </div>
            </div>

            {viewMode === 'calendar' ? (
              <>
                <div className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {MONTH_NAMES.map((name, i) => {
                    const m = i + 1;
                    const active = month === m;
                    const filledM = countFilledInMonth(byDay, m, calendarYear);
                    const totalM = daysInMonth(m, calendarYear);
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          setMonth(m);
                          setSelectedDay(null);
                        }}
                        className={cn(
                          'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all',
                          active
                            ? 'bg-violet-600 text-white shadow-md shadow-violet-500/15'
                            : 'bg-muted/60 text-muted-foreground hover:bg-muted',
                        )}
                        title={`${filledM}/${totalM} gün dolu`}
                      >
                        {name}
                        <span className="ml-1 tabular-nums opacity-80">
                          ({filledM}/{totalM})
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="rounded-2xl border border-border/50 bg-muted/20 p-2 sm:p-2.5">
                  <p className="mb-2 px-1 text-[11px] text-muted-foreground">
                    Hafta <strong className="text-foreground">Pazartesi</strong> ile başlar ·{' '}
                    <span className="tabular-nums">{calendarYear}</span> yılı hizalaması
                  </p>
                  <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                    {WEEKDAYS_TR.map((w) => (
                      <div
                        key={w.short}
                        title={w.long}
                        className="flex min-h-9 items-center justify-center rounded-lg bg-muted/70 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-muted-foreground dark:bg-muted/40"
                      >
                        {w.short}
                      </div>
                    ))}
                    {calendarCells.map((cell, idx) => {
                      if (cell.kind === 'empty') {
                        return (
                          <div
                            key={`e-${idx}`}
                            className="aspect-square min-h-9 w-full min-w-0 sm:min-h-10"
                            aria-hidden
                          />
                        );
                      }
                      const d = cell.n;
                      const key = mmdd(month, d);
                      const has = !!byDay[key]?.trim();
                      const sel = selectedDay === d;
                      return (
                        <button
                          key={key}
                          type="button"
                          title={`${key} ${MONTH_NAMES[month - 1]}`}
                          onClick={() => setSelectedDay(d)}
                          className={cn(
                            'relative flex aspect-square min-h-9 w-full min-w-0 items-center justify-center rounded-xl text-xs font-semibold transition-all sm:min-h-10',
                            sel
                              ? 'bg-violet-600 text-white shadow-md ring-2 ring-violet-400/40'
                              : has
                                ? 'bg-violet-500/12 text-violet-700 ring-1 ring-violet-500/25 dark:text-violet-200'
                                : 'bg-background/80 text-muted-foreground hover:bg-muted',
                          )}
                        >
                          {d}
                          {has && !sel && (
                            <span className="absolute bottom-1 right-1/2 size-1 translate-x-1/2 rounded-full bg-violet-500/80" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {selectedKey ? (
                  <div className="space-y-2 rounded-2xl border border-dashed border-violet-500/25 bg-violet-500/3 p-4 dark:bg-violet-500/5">
                    <label className="text-[13px] font-medium text-foreground/90" htmlFor="welcome-day-msg">
                      Bu güne mesaj — <span className="font-mono text-violet-600 dark:text-violet-400">{selectedKey}</span>
                    </label>
                    <WelcomeMessageToolbar
                      value={dayDraft}
                      onChange={(next) => {
                        setDayDraft(next);
                        setDayMessage(selectedKey, next);
                      }}
                      textareaRef={dayMsgRef}
                    />
                    <textarea
                      ref={dayMsgRef}
                      id="welcome-day-msg"
                      className="min-h-[100px] w-full resize-y rounded-xl border border-border/60 bg-background px-3 py-2.5 text-sm shadow-sm transition-colors focus-visible:border-violet-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/20"
                      rows={4}
                      maxLength={2000}
                      value={dayDraft}
                      onChange={(e) => {
                        const v = e.target.value;
                        setDayDraft(v);
                        setDayMessage(selectedKey, v);
                      }}
                      placeholder="**Kalın**, _italik_, emoji veya yeni satır (Kaydet)"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      {dayDraft.length}/2000 · Sunucuya yazmak için üstte <strong>Kaydet</strong> · Takvimde gün
                      seçiliyken ← → Home End
                    </p>
                    {(dayDraft.trim() || fallback.trim()) && (
                      <div
                        className="mt-3 rounded-2xl border border-violet-500/20 bg-linear-to-br from-violet-500/12 via-fuchsia-500/5 to-amber-500/10 p-4 shadow-sm ring-1 ring-white/30 dark:ring-white/5"
                        aria-label="Kullanıcı önizlemesi"
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-700/90 dark:text-violet-300/90">
                          Kullanıcıda böyle görünür
                        </p>
                        <WelcomeMessageDisplay
                          text={dayDraft.trim() || fallback.trim()}
                          className="mt-2 text-pretty text-base font-normal leading-relaxed"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="rounded-xl border border-border/40 bg-muted/20 px-4 py-3 text-center text-sm text-muted-foreground">
                    Düzenlemek için takvimden bir gün seçin veya &quot;Yıllık liste&quot; kullanın.
                  </p>
                )}
              </>
            ) : (
              <div className="max-h-[min(70vh,720px)] overflow-y-auto rounded-2xl border border-border/40 bg-muted/10">
                {MONTH_NAMES.map((name, i) => {
                  const m = i + 1;
                  const maxD = daysInMonth(m, calendarYear);
                  const filledM = countFilledInMonth(byDay, m, calendarYear);
                  return (
                    <details
                      key={m}
                      className="group border-b border-border/30 last:border-b-0"
                      {...({ defaultOpen: m === todayIst.m } as HTMLAttributes<HTMLDetailsElement>)}
                    >
                      <summary className="sticky top-0 z-10 flex cursor-pointer list-none items-center justify-between gap-2 border-b border-border/20 bg-card/95 px-3 py-2.5 backdrop-blur-md marker:content-none [&::-webkit-details-marker]:hidden">
                        <span className="text-sm font-semibold text-foreground">
                          {name}{' '}
                          <span className="text-[11px] font-normal tabular-nums text-muted-foreground">
                            ({filledM}/{maxD})
                          </span>
                        </span>
                        <span className="text-muted-foreground transition-transform group-open:rotate-180">▼</span>
                      </summary>
                      <div className="space-y-2 px-3 py-3">
                        {Array.from({ length: maxD }, (_, j) => j + 1).map((d) => {
                          const key = mmdd(m, d);
                          const val = byDay[key] ?? '';
                          const isToday = todayIst.m === m && todayIst.d === d;
                          return (
                            <div
                              key={key}
                              className={cn(
                                'flex flex-col gap-1.5 rounded-xl border border-transparent sm:flex-row sm:items-center sm:gap-3',
                                isToday && 'border-violet-500/30 bg-violet-500/5',
                              )}
                            >
                              <div className="flex w-full shrink-0 items-center justify-between gap-2 sm:w-28 sm:flex-col sm:items-start sm:justify-center sm:py-1">
                                <span className="font-mono text-xs font-medium text-muted-foreground">{key}</span>
                                {isToday && (
                                  <span className="rounded-md bg-violet-600/15 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 dark:text-violet-300">
                                    bugün
                                  </span>
                                )}
                              </div>
                              <Input
                                className={cn(
                                  'h-auto min-h-9 flex-1 rounded-xl py-2 text-sm',
                                  val.trim()
                                    ? 'border-emerald-500/40 bg-emerald-500/[0.04]'
                                    : 'border-border/60',
                                )}
                                value={val}
                                maxLength={2000}
                                placeholder={`${key} — bu güne mesaj yazın`}
                                aria-label={`${key} günü mesajı`}
                                onChange={(e) => setDayMessage(key, e.target.value)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden border-violet-500/20 bg-linear-to-r from-violet-500/8 via-transparent to-amber-500/8 shadow-sm">
        <CardContent className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-300">
              <Sparkles className="size-5" strokeWidth={1.75} />
            </div>
            <div>
              {!enabled && (
                <p className="mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-950 dark:text-amber-100">
                  Modül kapalı — bu önizleme kullanıcılara <strong>yansımaz</strong>.
                </p>
              )}
              <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-600/90 dark:text-violet-400/90">
                Bugün (İstanbul) — kullanıcıya gidecek metin
              </p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">{todayPublicPreview.date_key}</p>
              <div className="mt-2 text-pretty text-sm leading-relaxed text-foreground">
                {todayPublicPreview.message ? (
                  <WelcomeMessageDisplay
                    text={todayPublicPreview.message}
                    className="text-pretty text-sm font-normal leading-relaxed"
                  />
                ) : (
                  '— Bugün için mesaj yok (gün + yedek boş) —'
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
