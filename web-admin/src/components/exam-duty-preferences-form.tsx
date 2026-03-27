'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ClipboardList, Bell, CalendarClock, CalendarCheck } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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

const CATEGORY_ACCENTS: Record<string, string> = {
  meb: 'border-amber-200/60 bg-amber-50/50 dark:border-amber-800/40 dark:bg-amber-950/20',
  osym: 'border-blue-200/60 bg-blue-50/50 dark:border-blue-800/40 dark:bg-blue-950/20',
  aof: 'border-emerald-200/60 bg-emerald-50/50 dark:border-emerald-800/40 dark:bg-emerald-950/20',
  ataaof: 'border-violet-200/60 bg-violet-50/50 dark:border-violet-800/40 dark:bg-violet-950/20',
  auzef: 'border-teal-200/60 bg-teal-50/50 dark:border-teal-800/40 dark:bg-teal-950/20',
};

/** Tercih yokken backend’de kullanılan sabah hatırlatması (Türkiye) */
const DEFAULT_SYSTEM_MORNING_TIME = '07:00';

/** HTML time input için HH:mm (API tek haneli saat dönebilir) */
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
  /** Boş/null = sistem varsayılanı 07:00 */
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
        'flex min-h-[44px] min-w-0 cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-3 sm:gap-3 sm:px-3 sm:py-2 transition-colors touch-manipulation',
        checked
          ? 'border-primary/50 bg-primary/10 text-primary'
          : 'border-border bg-muted/20 text-muted-foreground hover:bg-muted/30 active:bg-muted/40'
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-5 shrink-0 rounded border-2 border-primary accent-primary sm:size-4"
      />
      <Icon className="size-5 shrink-0 sm:size-4" />
      <span className="mt-0.5 min-w-0 break-words leading-tight text-xs font-medium sm:mt-0 sm:text-sm hidden sm:inline">{label}</span>
      <span className="mt-0.5 min-w-0 break-words leading-tight text-xs font-medium sm:mt-0 sm:text-sm sm:hidden">{shortLabel}</span>
    </label>
  );
}

export function ExamDutyPreferencesForm() {
  const { token, me } = useAuth();
  const [items, setItems] = useState<CategoryPref[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  const updateLocal = (slug: string, field: keyof CategoryPref, value: boolean | string | null) => {
    setItems((prev) =>
      prev.map((p) => (p.slug === slug ? { ...p, [field]: value } : p))
    );
  };

  const updateMorningTimeAll = (time: string) => {
    const v = time === '' ? null : time;
    setItems((prev) => prev.map((p) => ({ ...p, pref_exam_day_morning_time: v })));
  };

  const morningTime = items[0]?.pref_exam_day_morning_time ?? '';

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
    <Card className="overflow-hidden rounded-xl border-border/80 shadow-sm">
      <CardHeader className="border-b border-border/50 bg-muted/20">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-semibold sm:text-base">
              <ClipboardList className="size-5 shrink-0 text-primary" />
              <span className="break-words">Bildirim Tercihleri</span>
            </CardTitle>
            <p className="mt-1 break-words text-xs text-muted-foreground sm:text-sm">
              Varsayılan olarak tüm kategorilerden bildirim alırsınız. Sınav günü sabah hatırlatması için 06:00–13:59 arası istediğiniz dakikayı seçebilirsiniz; varsayılanı işaretlerseniz sistem 07:00 kullanır.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 min-h-[44px] text-xs sm:min-h-0 sm:text-sm"
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
              Tümünü Aç
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 min-h-[44px] text-xs sm:min-h-0 sm:text-sm"
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
              Tümünü Kapat
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        {loading ? (
          <div className="flex min-h-[200px] items-center justify-center">
            <LoadingSpinner className="size-6" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((cat) => (
                <div
                  key={cat.slug}
                  className={cn(
                    'min-w-0 rounded-xl border p-4 transition-colors',
                    CATEGORY_ACCENTS[cat.slug] ?? 'border-border bg-muted/10'
                  )}
                >
                  <div className="mb-3 min-w-0">
                    <h4 className="break-words text-sm font-semibold text-foreground sm:text-base">
                      {CATEGORY_LABELS[cat.slug] ?? cat.slug}
                    </h4>
                    {CATEGORY_DESC[cat.slug] && (
                      <p className="mt-0.5 line-clamp-2 break-words text-[11px] text-muted-foreground sm:text-xs">
                        {CATEGORY_DESC[cat.slug]}
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {PREF_OPTIONS.map((opt) => (
                      <PrefToggle
                        key={opt.key}
                        checked={cat[opt.key]}
                        onChange={(v) => updateLocal(cat.slug, opt.key, v)}
                        label={opt.label}
                        shortLabel={opt.shortLabel}
                        Icon={opt.icon}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
              <span className="min-w-0 break-words text-xs font-medium text-foreground sm:text-sm">
                Sınav günü sabah hatırlatması saati
              </span>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground sm:text-sm">
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
                    className="h-11 rounded-lg border border-input bg-background px-2 py-1 text-sm touch-manipulation sm:h-9"
                    aria-label="Sabah hatırlatması özel saati"
                  />
                </div>
              )}
              <span className="min-w-0 break-words text-[11px] text-muted-foreground sm:text-xs">
                Görev çıktı işaretlediğiniz sınavlar için. Özel saat 06:00–13:59 arası; bildirim seçtiğiniz dakikada tetiklenir (varsayılan: 07:00).
              </span>
            </div>
            <div className="flex justify-end border-t border-border/50 pt-4">
              <Button onClick={handleSave} disabled={saving} className="gap-2 text-xs sm:text-sm">
                {saving && <LoadingSpinner className="size-4" />}
                {saving ? 'Kaydediliyor…' : 'Tercihleri Kaydet'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
