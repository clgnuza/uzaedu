'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Bell, CalendarClock, CalendarCheck, Clock, Save } from 'lucide-react';
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

const CATEGORY_TAB_WELL: Record<string, { active: string; idle: string; tabOuter: string }> = {
  meb: {
    active:
      'bg-amber-500/22 text-amber-900 ring-1 ring-amber-500/40 dark:bg-amber-500/16 dark:text-amber-200 dark:ring-amber-400/35',
    idle: 'bg-muted/75 text-muted-foreground ring-1 ring-border/40',
    tabOuter: 'border-amber-300/65 bg-amber-50/88 shadow-sm dark:border-amber-800/55 dark:bg-amber-950/38',
  },
  osym: {
    active:
      'bg-blue-500/22 text-blue-900 ring-1 ring-blue-500/38 dark:bg-blue-500/16 dark:text-blue-200 dark:ring-blue-400/35',
    idle: 'bg-muted/75 text-muted-foreground ring-1 ring-border/40',
    tabOuter: 'border-blue-300/65 bg-blue-50/88 shadow-sm dark:border-blue-800/55 dark:bg-blue-950/38',
  },
  aof: {
    active:
      'bg-emerald-500/22 text-emerald-900 ring-1 ring-emerald-500/38 dark:bg-emerald-500/16 dark:text-emerald-200 dark:ring-emerald-400/35',
    idle: 'bg-muted/75 text-muted-foreground ring-1 ring-border/40',
    tabOuter: 'border-emerald-300/65 bg-emerald-50/88 shadow-sm dark:border-emerald-800/55 dark:bg-emerald-950/38',
  },
  ataaof: {
    active:
      'bg-violet-500/22 text-violet-900 ring-1 ring-violet-500/38 dark:bg-violet-500/16 dark:text-violet-200 dark:ring-violet-400/35',
    idle: 'bg-muted/75 text-muted-foreground ring-1 ring-border/40',
    tabOuter: 'border-violet-300/65 bg-violet-50/88 shadow-sm dark:border-violet-800/55 dark:bg-violet-950/38',
  },
  auzef: {
    active:
      'bg-teal-500/22 text-teal-900 ring-1 ring-teal-500/38 dark:bg-teal-500/16 dark:text-teal-200 dark:ring-teal-400/35',
    idle: 'bg-muted/75 text-muted-foreground ring-1 ring-border/40',
    tabOuter: 'border-teal-300/65 bg-teal-50/88 shadow-sm dark:border-teal-800/55 dark:bg-teal-950/38',
  },
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
  { key: 'pref_publish' as const, label: 'Yayınlanınca', shortLabel: 'Yayın', icon: Bell },
  { key: 'pref_deadline' as const, label: 'Son başvuru günü', shortLabel: 'Son b.', icon: CalendarClock },
  { key: 'pref_approval_day' as const, label: 'Onay günü', shortLabel: 'Onay', icon: CalendarClock },
  { key: 'pref_exam_minus_1d' as const, label: 'Sınavdan 1 gün önce', shortLabel: 'Sınav -1', icon: CalendarCheck },
  { key: 'pref_exam_plus_1d' as const, label: 'Sınavdan 1 gün sonra', shortLabel: 'Sınav +1', icon: CalendarCheck },
  { key: 'pref_exam_day_morning' as const, label: 'Sınav günü sabah hatırlatma', shortLabel: 'Sabah', icon: Bell },
];

function PrefToggle({
  checked,
  onChange,
  label,
  shortLabel,
  Icon,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  shortLabel: string;
  Icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <label
      className={cn(
        'flex min-h-[44px] min-w-0 cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-3 sm:gap-3 sm:px-3 sm:py-2.5 transition-colors touch-manipulation',
        checked
          ? 'border-primary/45 bg-primary/10 text-primary shadow-sm'
          : 'border-border/80 bg-background/50 text-muted-foreground hover:bg-muted/40 active:bg-muted/50'
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-5 shrink-0 rounded border-2 border-primary accent-primary sm:size-4"
      />
      <Icon className="size-5 shrink-0 sm:size-4" />
      <span className="mt-0.5 hidden min-w-0 wrap-break-word text-xs font-medium leading-tight sm:mt-0 sm:inline sm:text-sm">
        {label}
      </span>
      <span className="mt-0.5 min-w-0 wrap-break-word text-xs font-medium leading-tight sm:mt-0 sm:hidden sm:text-sm">
        {shortLabel}
      </span>
    </label>
  );
}

export function ExamDutyPreferencesForm() {
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
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  if (me?.role !== 'teacher') return null;

  return (
    <Card className="overflow-hidden rounded-xl border-border/70 shadow-md">
      <CardHeader className="border-b border-border/50 bg-muted/25 px-4 py-4 sm:px-5">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base font-semibold tracking-tight">Bildirim tercihleri</CardTitle>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
              Kurum sekmesinden hangi bildirimleri alacağınızı seçin. Sabah saati tüm kurumlar için ortaktır.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-[40px] text-xs sm:min-h-9 sm:text-sm"
              onClick={() =>
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
                )
              }
            >
              Tümünü aç
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-[40px] text-xs sm:min-h-9 sm:text-sm"
              onClick={() =>
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
                )
              }
            >
              Tümünü kapat
            </Button>
          </div>
        </div>

        {/* Kurum sekmeleri */}
        {!loading && items.length > 0 && (
          <div
            className="mt-4 flex gap-1 overflow-x-auto rounded-xl border border-border/45 bg-linear-to-b from-muted/55 to-muted/35 p-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden"
            role="tablist"
            aria-label="Kurum bildirim tercihleri"
          >
            {items.map((cat) => {
              const active = activeSlug === cat.slug;
              const well = CATEGORY_TAB_WELL[cat.slug] ?? {
                active: 'bg-primary/15 text-primary ring-1 ring-primary/30',
                idle: 'bg-muted/75 text-muted-foreground ring-1 ring-border/40',
                tabOuter: 'border-primary/35 bg-primary/5 shadow-sm',
              };
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
                    'flex min-h-[48px] min-w-19 shrink-0 flex-col items-center justify-center gap-1 rounded-xl px-2 py-1.5 text-center transition-all touch-manipulation sm:min-h-[44px] sm:min-w-0 sm:flex-row sm:gap-2.5 sm:px-3.5',
                    active
                      ? cn('text-foreground', well.tabOuter)
                      : 'border border-transparent text-muted-foreground hover:border-border/55 hover:bg-background/75 hover:text-foreground'
                  )}
                >
                  <span
                    className={cn(
                      'flex size-9 items-center justify-center rounded-lg',
                      active ? well.active : well.idle
                    )}
                  >
                    <KurumIcon className="size-4.5 sm:size-5" aria-hidden />
                  </span>
                  <span className="text-[11px] font-bold leading-tight sm:text-xs">{CATEGORY_LABELS[cat.slug] ?? cat.slug}</span>
                </button>
              );
            })}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-6 p-4 sm:p-6">
        {loading ? (
          <div className="flex min-h-[180px] items-center justify-center">
            <LoadingSpinner className="size-6" />
          </div>
        ) : !activeCat ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Tercih yüklenemedi.</p>
        ) : (
          <>
            <div
              className={cn(
                'rounded-xl border p-4 sm:p-5',
                CATEGORY_PANEL[activeCat.slug] ?? 'border-border bg-muted/10'
              )}
            >
              <div className="mb-4 min-w-0 border-b border-border/40 pb-3">
                <h4 className="text-sm font-semibold text-foreground sm:text-base">
                  {CATEGORY_LABELS[activeCat.slug] ?? activeCat.slug}
                </h4>
                {CATEGORY_DESC[activeCat.slug] && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs">
                    {CATEGORY_DESC[activeCat.slug]}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {PREF_OPTIONS.map((opt) => (
                  <PrefToggle
                    key={opt.key}
                    checked={activeCat[opt.key]}
                    onChange={(v) => updateLocal(activeCat.slug, opt.key, v)}
                    label={opt.label}
                    shortLabel={opt.shortLabel}
                    Icon={opt.icon}
                  />
                ))}
              </div>
            </div>

            <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-primary/6 p-4 dark:bg-primary/10">
              <div className="absolute left-0 top-0 h-full w-1 bg-primary/70" aria-hidden />
              <div className="pl-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Clock className="size-4 text-primary" />
                  Sabah hatırlatması saati
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Görev çıktı işaretlediğiniz sınavlar için. Varsayılan 07:00; 06:00–13:59 arası özelleştirebilirsiniz.
                </p>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={morningTime === ''}
                      onChange={(e) => {
                        if (e.target.checked) updateMorningTimeAll('');
                        else updateMorningTimeAll(DEFAULT_SYSTEM_MORNING_TIME);
                      }}
                      className="size-4 shrink-0 rounded border-2 border-input accent-primary"
                    />
                    Sistem varsayılanı (07:00)
                  </label>
                  {morningTime !== '' && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground">Özel saat (Türkiye)</span>
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
                        className="h-11 min-h-[44px] rounded-lg border border-input bg-background px-2 py-1 text-sm shadow-sm touch-manipulation sm:h-10 sm:min-h-0"
                        aria-label="Sabah hatırlatması özel saati"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-border/50 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[11px] text-muted-foreground sm:text-xs">
                Değişiklikler kaydedilene kadar sunucuya yazılmaz.
              </p>
              <Button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="w-full gap-2 sm:w-auto"
                size="default"
              >
                {saving ? <LoadingSpinner className="size-4" /> : <Save className="size-4" />}
                {saving ? 'Kaydediliyor…' : 'Tercihleri kaydet'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
