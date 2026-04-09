'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  Bell,
  CalendarClock,
  CalendarCheck,
  Clock,
  Save,
  SlidersHorizontal,
  ListChecks,
  CircleSlash,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { KURUM_SVG } from '@/components/exam-duty-icons';

const CATEGORY_LABELS: Record<string, string> = {
  meb: 'MEB',
  osym: 'ÖSYM',
  aof: 'AÖF',
  ataaof: 'ATA-AÖF',
  auzef: 'AUZEF',
};

const CATEGORY_DESC: Record<string, string> = {
  meb: 'Milli Eğitim Bakanlığı sınav görevleri',
  osym: 'ÖSYM gözetmenlik vb.',
  aof: 'Anadolu Üniversitesi Açıköğretim',
  ataaof: 'ATA-AÖF sınav görevleri',
  auzef: 'İstanbul Üniversitesi AUZEF',
};

const CATEGORY_TAB_WELL: Record<string, { tabIdle: string; tabActive: string; iconIdle: string; iconActive: string }> = {
  meb: {
    tabIdle:
      'border border-amber-200/85 bg-linear-to-b from-amber-50/95 to-orange-50/35 text-amber-950 shadow-sm hover:border-amber-300 hover:shadow-md dark:border-amber-900/45 dark:from-amber-950/40 dark:to-orange-950/25 dark:text-amber-100',
    tabActive:
      'border-2 border-amber-400/85 bg-linear-to-br from-amber-100 via-amber-50 to-orange-50 text-amber-950 shadow-lg shadow-amber-500/30 ring-2 ring-amber-400/45 dark:border-amber-500 dark:from-amber-900/65 dark:via-amber-950 dark:to-orange-950/55 dark:text-amber-50 dark:shadow-amber-950/45 dark:ring-amber-500/40',
    iconIdle: 'bg-amber-200/85 text-amber-950 dark:bg-amber-800/55 dark:text-amber-100',
    iconActive: 'bg-amber-600 text-white shadow-inner dark:bg-amber-500',
  },
  osym: {
    tabIdle:
      'border border-sky-200/85 bg-linear-to-b from-sky-50/95 to-cyan-50/40 text-sky-950 shadow-sm hover:border-sky-300 hover:shadow-md dark:border-sky-900/45 dark:from-sky-950/45 dark:to-cyan-950/25 dark:text-sky-100',
    tabActive:
      'border-2 border-sky-400/85 bg-linear-to-br from-sky-100 via-sky-50 to-cyan-50 text-sky-950 shadow-lg shadow-sky-500/28 ring-2 ring-sky-400/42 dark:border-sky-500 dark:from-sky-900/65 dark:via-sky-950 dark:to-cyan-950/55 dark:text-sky-50 dark:shadow-sky-950/45 dark:ring-sky-500/38',
    iconIdle: 'bg-sky-200/85 text-sky-950 dark:bg-sky-800/55 dark:text-sky-100',
    iconActive: 'bg-sky-600 text-white shadow-inner dark:bg-sky-500',
  },
  aof: {
    tabIdle:
      'border border-emerald-200/80 bg-linear-to-b from-emerald-50/95 to-teal-50/40 text-emerald-900 shadow-sm hover:border-emerald-300 hover:shadow-md dark:border-emerald-900/50 dark:from-emerald-950/45 dark:to-teal-950/25 dark:text-emerald-100',
    tabActive:
      'border-2 border-emerald-400/80 bg-linear-to-br from-emerald-100 via-emerald-50 to-teal-50 text-emerald-950 shadow-lg shadow-emerald-500/25 ring-2 ring-emerald-400/40 dark:border-emerald-500 dark:from-emerald-900/70 dark:via-emerald-950 dark:to-teal-950/60 dark:text-emerald-50 dark:shadow-emerald-950/50 dark:ring-emerald-500/35',
    iconIdle: 'bg-emerald-200/80 text-emerald-900 dark:bg-emerald-800/60 dark:text-emerald-100',
    iconActive: 'bg-emerald-600 text-white shadow-inner dark:bg-emerald-500',
  },
  ataaof: {
    tabIdle:
      'border border-violet-200/85 bg-linear-to-b from-violet-50/95 to-fuchsia-50/35 text-violet-950 shadow-sm hover:border-violet-300 hover:shadow-md dark:border-violet-900/45 dark:from-violet-950/40 dark:to-fuchsia-950/25 dark:text-violet-100',
    tabActive:
      'border-2 border-violet-400/85 bg-linear-to-br from-violet-100 via-violet-50 to-fuchsia-50 text-violet-950 shadow-lg shadow-violet-500/28 ring-2 ring-violet-400/42 dark:border-violet-500 dark:from-violet-900/65 dark:via-violet-950 dark:to-fuchsia-950/55 dark:text-violet-50 dark:shadow-violet-950/45 dark:ring-violet-500/38',
    iconIdle: 'bg-violet-200/85 text-violet-950 dark:bg-violet-800/55 dark:text-violet-100',
    iconActive: 'bg-violet-600 text-white shadow-inner dark:bg-violet-500',
  },
  auzef: {
    tabIdle:
      'border border-teal-200/85 bg-linear-to-b from-teal-50/95 to-cyan-50/40 text-teal-950 shadow-sm hover:border-teal-300 hover:shadow-md dark:border-teal-900/45 dark:from-teal-950/45 dark:to-cyan-950/25 dark:text-teal-100',
    tabActive:
      'border-2 border-teal-400/85 bg-linear-to-br from-teal-100 via-teal-50 to-cyan-50 text-teal-950 shadow-lg shadow-teal-500/28 ring-2 ring-teal-400/42 dark:border-teal-500 dark:from-teal-900/65 dark:via-teal-950 dark:to-cyan-950/55 dark:text-teal-50 dark:shadow-teal-950/45 dark:ring-teal-500/38',
    iconIdle: 'bg-teal-200/85 text-teal-950 dark:bg-teal-800/55 dark:text-teal-100',
    iconActive: 'bg-teal-600 text-white shadow-inner dark:bg-teal-500',
  },
};

const CATEGORY_TAB_FALLBACK = {
  tabIdle:
    'border border-slate-200/80 bg-linear-to-b from-slate-50/95 to-slate-100/50 text-slate-700 shadow-sm hover:border-slate-300 dark:border-slate-700/70 dark:from-slate-900/55 dark:to-slate-950/40 dark:text-slate-200',
  tabActive:
    'border-2 border-slate-400/75 bg-linear-to-br from-white via-slate-50 to-slate-100 text-slate-900 shadow-lg shadow-slate-500/20 ring-2 ring-slate-400/35 dark:border-slate-500 dark:from-slate-800 dark:via-slate-900 dark:to-slate-950 dark:text-white dark:ring-slate-500/45',
  iconIdle: 'bg-slate-200/70 text-slate-800 dark:bg-slate-700/60 dark:text-slate-100',
  iconActive: 'bg-slate-600 text-white shadow-inner dark:bg-slate-500',
};

const CATEGORY_PANEL: Record<string, string> = {
  meb: 'border-amber-300/65 bg-linear-to-br from-amber-50/95 to-amber-50/50 dark:border-amber-800/50 dark:from-amber-950/40 dark:to-amber-950/20',
  osym: 'border-blue-300/65 bg-linear-to-br from-blue-50/95 to-blue-50/50 dark:border-blue-800/50 dark:from-blue-950/40 dark:to-blue-950/20',
  aof: 'border-emerald-300/65 bg-linear-to-br from-emerald-50/95 to-emerald-50/50 dark:border-emerald-800/50 dark:from-emerald-950/40 dark:to-emerald-950/20',
  ataaof: 'border-violet-300/65 bg-linear-to-br from-violet-50/95 to-violet-50/50 dark:border-violet-800/50 dark:from-violet-950/40 dark:to-violet-950/20',
  auzef: 'border-teal-300/65 bg-linear-to-br from-teal-50/95 to-teal-50/50 dark:border-teal-800/50 dark:from-teal-950/40 dark:to-teal-950/20',
};

const DEFAULT_SYSTEM_MORNING_TIME = '07:00';

function toTimeInputValue(t: string | null | undefined): string {
  if (t == null || t === '') return '';
  const m = String(t).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return '';
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

type CategoryPref = {
  slug: string;
  pref_publish: boolean;
  pref_deadline: boolean;
  pref_approval_day: boolean;
  pref_exam_minus_1d: boolean;
  pref_exam_plus_1d: boolean;
  pref_exam_day_morning: boolean;
  pref_exam_day_morning_time?: string | null;
};

const PREF_OPTIONS = [
  {
    key: 'pref_publish' as const,
    label: 'Yeni duyuru çıkınca bildir',
    icon: Bell,
  },
  {
    key: 'pref_deadline' as const,
    label: 'Son başvuru günü yaklaşınca',
    icon: CalendarClock,
  },
  {
    key: 'pref_approval_day' as const,
    label: 'Görev listesi onay günü',
    icon: CalendarClock,
  },
  {
    key: 'pref_exam_minus_1d' as const,
    label: 'Sınavdan bir gün önce',
    icon: CalendarCheck,
  },
  {
    key: 'pref_exam_plus_1d' as const,
    label: 'Sınavdan bir gün sonra',
    icon: CalendarCheck,
  },
  {
    key: 'pref_exam_day_morning' as const,
    label: 'Sınav günü sabah hatırlatması',
    icon: Bell,
  },
];

function PrefToggle({
  checked,
  onChange,
  label,
  Icon,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <label
      className={cn(
        'flex min-h-0 min-w-0 cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1.5 transition-colors touch-manipulation sm:gap-2 sm:rounded-lg sm:px-2.5 sm:py-2',
        checked
          ? 'border-primary/45 bg-primary/10 text-primary shadow-sm'
          : 'border-border/70 bg-background/60 text-muted-foreground hover:bg-muted/35 active:bg-muted/45'
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 shrink-0 rounded border-2 border-primary accent-primary"
      />
      <Icon className="size-3.5 shrink-0 opacity-90 sm:size-4" aria-hidden />
      <span className="min-w-0 flex-1 text-[10px] font-medium leading-snug sm:text-xs sm:leading-tight">{label}</span>
    </label>
  );
}

type ExamDutyPreferencesFormProps = {
  /** Başarılı kayıttan sonra (ör. üst sayfadaki paneli kapat) */
  onSaved?: () => void;
};

export function ExamDutyPreferencesForm({ onSaved }: ExamDutyPreferencesFormProps) {
  const { token, me } = useAuth();
  const [items, setItems] = useState<CategoryPref[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSlug, setActiveSlug] = useState<string>('');

  const fetchPrefs = useCallback(async () => {
    if (!token || me?.role !== 'teacher') return;
    setLoading(true);
    try {
      const data = await apiFetch<CategoryPref[]>('/exam-duty-preferences', { token });
      const list = Array.isArray(data) ? data : [];
      setItems(
        list.map((p) => ({
          ...p,
          pref_approval_day: p.pref_approval_day ?? true,
          pref_exam_day_morning: p.pref_exam_day_morning ?? true,
          pref_exam_day_morning_time:
            (p as { pref_exam_day_morning_time?: string | null }).pref_exam_day_morning_time ?? null,
        }))
      );
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token, me?.role]);

  useEffect(() => {
    fetchPrefs();
  }, [fetchPrefs]);

  useEffect(() => {
    if (!items.length) return;
    if (!activeSlug || !items.some((p) => p.slug === activeSlug)) {
      setActiveSlug(items[0].slug);
    }
  }, [items, activeSlug]);

  const updateLocal = (slug: string, field: keyof CategoryPref, value: boolean | string | null) => {
    setItems((prev) => prev.map((p) => (p.slug === slug ? { ...p, [field]: value } : p)));
  };

  const updateMorningTimeAll = (time: string) => {
    const v = time === '' ? null : time;
    setItems((prev) => prev.map((p) => ({ ...p, pref_exam_day_morning_time: v })));
  };

  const morningTime = items[0]?.pref_exam_day_morning_time ?? '';
  const activeCat = items.find((p) => p.slug === activeSlug);

  const handleSave = async () => {
    if (!token || me?.role !== 'teacher') return;
    setSaving(true);
    try {
      await apiFetch('/exam-duty-preferences', {
        method: 'PATCH',
        token,
        body: JSON.stringify({
          categories: items.map((p) => ({
            slug: p.slug,
            pref_publish: p.pref_publish ?? true,
            pref_deadline: p.pref_deadline ?? true,
            pref_approval_day: p.pref_approval_day ?? true,
            pref_exam_minus_1d: p.pref_exam_minus_1d ?? true,
            pref_exam_plus_1d: p.pref_exam_plus_1d ?? true,
            pref_exam_day_morning: p.pref_exam_day_morning ?? true,
            pref_exam_day_morning_time:
              p.pref_exam_day_morning_time && p.pref_exam_day_morning_time !== ''
                ? p.pref_exam_day_morning_time
                : null,
          })),
        }),
      });
      toast.success('Sınav görevi tercihleri kaydedildi');
      onSaved?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const openAllPrefs = () =>
    setItems((prev) =>
      prev.map((p) => ({
        ...p,
        pref_publish: true,
        pref_deadline: true,
        pref_approval_day: true,
        pref_exam_minus_1d: true,
        pref_exam_plus_1d: true,
        pref_exam_day_morning: true,
        pref_exam_day_morning_time: morningTime === '' ? null : morningTime,
      }))
    );

  const closeAllPrefs = () =>
    setItems((prev) =>
      prev.map((p) => ({
        ...p,
        pref_publish: false,
        pref_deadline: false,
        pref_approval_day: false,
        pref_exam_minus_1d: false,
        pref_exam_plus_1d: false,
        pref_exam_day_morning: false,
      }))
    );

  if (me?.role !== 'teacher') return null;

  return (
    <Card className="overflow-hidden rounded-2xl border-border/50 shadow-md ring-1 ring-black/5 dark:ring-white/10">
      <CardHeader className="space-y-0 border-b-0 p-0">
        <div className="relative overflow-hidden bg-linear-to-br from-violet-600 via-indigo-600 to-sky-600 px-3 py-2.5 sm:px-4 sm:py-3 dark:from-violet-800 dark:via-indigo-800 dark:to-sky-800">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.12]"
            style={{
              backgroundImage:
                'radial-gradient(circle at 20% 20%, white 0%, transparent 45%), radial-gradient(circle at 80% 80%, #fbbf24 0%, transparent 40%)',
            }}
            aria-hidden
          />
          <div className="relative flex min-h-[44px] flex-wrap items-center gap-x-2 gap-y-2 sm:gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white shadow-inner ring-1 ring-white/25">
              <SlidersHorizontal className="size-4 sm:size-[18px]" aria-hidden />
            </div>
            <div className="min-w-0 flex-1 basis-[min(100%,12rem)]">
              <h1 className="truncate text-[15px] font-bold leading-tight tracking-tight text-white sm:text-base">
                Bildirim tercihleri
              </h1>
              <p className="truncate text-[11px] leading-snug text-white/85 sm:text-xs">
                Kurum seç → bildirim türleri · sabah saati ortak
              </p>
            </div>
            <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 text-white hover:bg-white/20 sm:size-10"
                onClick={() => void fetchPrefs()}
                disabled={loading}
                aria-label="Yenile"
              >
                <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 text-white hover:bg-white/20 sm:size-10"
                onClick={openAllPrefs}
                disabled={loading || !items.length}
                aria-label="Tümünü aç"
              >
                <ListChecks className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 text-white hover:bg-white/20 sm:size-10"
                onClick={closeAllPrefs}
                disabled={loading || !items.length}
                aria-label="Tümünü kapat"
              >
                <CircleSlash className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" className="size-9 text-white hover:bg-white/20 sm:size-10" asChild>
                <Link href="/bildirimler" aria-label="Bildirimler">
                  <Bell className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {!loading && items.length > 0 && (
          <div className="border-b border-border/40 bg-linear-to-b from-violet-50/40 via-muted/25 to-muted/10 px-2.5 pb-3 pt-3 dark:from-violet-950/20 sm:px-4">
            <div
              className="grid gap-1 sm:gap-2"
              style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
              role="tablist"
              aria-label="Kurum bildirim tercihleri"
            >
              {items.map((cat) => {
                const active = activeSlug === cat.slug;
                const well = CATEGORY_TAB_WELL[cat.slug] ?? CATEGORY_TAB_FALLBACK;
                const KurumIcon = KURUM_SVG[cat.slug] ?? KURUM_SVG.meb;
                const hint = CATEGORY_DESC[cat.slug] ?? '';
                return (
                  <button
                    key={cat.slug}
                    type="button"
                    role="tab"
                    title={hint}
                    aria-label={`${CATEGORY_LABELS[cat.slug] ?? cat.slug}. ${hint}`}
                    aria-selected={active}
                    onClick={() => setActiveSlug(cat.slug)}
                    className={cn(
                      'flex min-h-18 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-1.5 text-[9px] font-semibold leading-tight transition-all active:scale-[0.98] touch-manipulation sm:min-h-15 sm:gap-1 sm:rounded-2xl sm:px-1 sm:py-2 sm:text-[11px] md:text-xs',
                      active ? well.tabActive : well.tabIdle
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-7 shrink-0 items-center justify-center rounded-lg sm:size-9 sm:rounded-xl',
                        active ? well.iconActive : well.iconIdle
                      )}
                    >
                      <KurumIcon className="size-[15px] sm:size-[18px]" aria-hidden />
                    </span>
                    <span className="w-full truncate text-center text-balance">
                      {CATEGORY_LABELS[cat.slug] ?? cat.slug}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-3 p-3 sm:space-y-5 sm:p-6">
        {loading ? (
          <div className="flex min-h-[120px] items-center justify-center py-6">
            <LoadingSpinner className="size-6" />
          </div>
        ) : !activeCat ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Tercih yüklenemedi.</p>
        ) : (
          <>
            <div
              className={cn(
                'rounded-lg border p-2.5 sm:rounded-xl sm:p-4',
                CATEGORY_PANEL[activeCat.slug] ?? 'border-border bg-muted/10'
              )}
            >
              <div className="mb-2 min-w-0 border-b border-border/40 pb-2 sm:mb-3 sm:pb-3">
                <h4 className="text-xs font-semibold text-foreground sm:text-sm md:text-base">
                  {CATEGORY_LABELS[activeCat.slug] ?? activeCat.slug}
                </h4>
                {CATEGORY_DESC[activeCat.slug] && (
                  <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground sm:text-xs">
                    {CATEGORY_DESC[activeCat.slug]}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                {PREF_OPTIONS.map((opt) => (
                  <PrefToggle
                    key={opt.key}
                    checked={activeCat[opt.key]}
                    onChange={(v) => updateLocal(activeCat.slug, opt.key, v)}
                    label={opt.label}
                    Icon={opt.icon}
                  />
                ))}
              </div>
            </div>

            <div className="relative overflow-hidden rounded-lg border border-primary/20 bg-primary/6 p-2.5 dark:bg-primary/10 sm:rounded-xl sm:p-4">
              <div className="absolute left-0 top-0 h-full w-0.5 bg-primary/70 sm:w-1" aria-hidden />
              <div className="pl-2 sm:pl-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground sm:text-sm">
                  <Clock className="size-3.5 shrink-0 text-primary sm:size-4" />
                  Sabah hatırlatması saati
                </div>
                <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground sm:mt-1 sm:text-xs">
                  Görev çıktı işaretlediğiniz sınavlar. Varsayılan 07:00; 06:00–13:59 özelleştirilebilir.
                </p>
                <div className="mt-2 flex flex-col gap-2 sm:mt-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-foreground sm:text-sm">
                    <input
                      type="checkbox"
                      checked={morningTime === ''}
                      onChange={(e) => {
                        if (e.target.checked) updateMorningTimeAll('');
                        else updateMorningTimeAll(DEFAULT_SYSTEM_MORNING_TIME);
                      }}
                      className="size-3.5 shrink-0 rounded border-2 border-input accent-primary sm:size-4"
                    />
                    Sistem varsayılanı (07:00)
                  </label>
                  {morningTime !== '' && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground sm:text-xs">Özel saat</span>
                      <input
                        type="time"
                        min="06:00"
                        max="13:59"
                        step={60}
                        value={toTimeInputValue(morningTime)}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v) updateMorningTimeAll(v);
                          else updateMorningTimeAll(DEFAULT_SYSTEM_MORNING_TIME);
                        }}
                        className="h-9 min-h-9 rounded-md border border-input bg-background px-2 text-xs shadow-sm touch-manipulation sm:h-10 sm:min-h-10 sm:text-sm"
                        aria-label="Sabah hatırlatması özel saati"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-border/50 pt-3 sm:flex-row sm:items-center sm:justify-between sm:pt-4">
              <p className="text-[10px] text-muted-foreground sm:text-xs">
                Kaydetmeden sunucuya yazılmaz.
              </p>
              <Button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="h-10 w-full gap-2 sm:h-9 sm:w-auto"
                size="default"
              >
                {saving ? <LoadingSpinner className="size-4" /> : <Save className="size-4" />}
                {saving ? 'Kaydediliyor…' : 'Kaydet'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
