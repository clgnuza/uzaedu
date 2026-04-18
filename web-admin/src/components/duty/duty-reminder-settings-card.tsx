'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { cn } from '@/lib/utils';

/** Yalnızca öğretmen; sadece Nöbet › Tercihler sayfasında kullanılır. */
export function DutyReminderSettingsCard() {
  const { me, token, role, refetchMe } = useAuth();
  const [enabled, setEnabled] = useState(true);
  const [timeTr, setTimeTr] = useState('07:00');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!me) return;
    setEnabled(me.duty_reminder_enabled !== false);
    setTimeTr(me.duty_reminder_time_tr ?? '07:00');
    setDirty(false);
  }, [me?.id, me?.duty_reminder_enabled, me?.duty_reminder_time_tr]);

  const save = useCallback(async () => {
    if (!token) return;
    setSaving(true);
    try {
      await apiFetch('/me', {
        method: 'PATCH',
        token,
        body: JSON.stringify({
          duty_reminder_enabled: enabled,
          duty_reminder_time_tr: timeTr,
        }),
      });
      toast.success('Nöbet bildirimi kaydedildi (TSİ).');
      await refetchMe();
      setDirty(false);
    } catch {
      toast.error('Kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  }, [token, enabled, timeTr, refetchMe]);

  if (role !== 'teacher') return null;

  return (
    <div
      className={cn(
        'rounded-xl border border-violet-200/40 bg-linear-to-br from-violet-500/6 via-background to-sky-500/5 p-3 shadow-sm',
        'dark:border-violet-500/20 dark:from-violet-500/10 dark:via-background dark:to-sky-500/5',
      )}
    >
      <div className="flex flex-wrap items-start gap-2.5 sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-600 dark:text-violet-300">
            <Bell className="size-3.5" strokeWidth={2} aria-hidden />
          </span>
          <div className="min-w-0 space-y-0.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground/90">Nöbet günü bildirimi</p>
            <p className="text-[10px] leading-snug text-muted-foreground">
              TSİ ile saat; nöbetiniz olan gün gelen kutunuza hatırlatma gider.
            </p>
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          <label className="flex cursor-pointer items-center gap-1.5 text-[10px] font-medium text-foreground/85">
            <input
              type="checkbox"
              className="size-3.5 rounded border-input accent-violet-600"
              checked={enabled}
              onChange={(e) => {
                setEnabled(e.target.checked);
                setDirty(true);
              }}
            />
            Açık
          </label>
          <input
            id="duty-reminder-time"
            type="time"
            step={60}
            disabled={!enabled}
            value={timeTr}
            onChange={(e) => {
              setTimeTr(e.target.value);
              setDirty(true);
            }}
            className={cn(
              'h-8 w-25 rounded-lg border border-input/80 bg-background/90 px-1.5 text-[11px] font-medium tabular-nums shadow-xs',
              !enabled && 'cursor-not-allowed opacity-45',
            )}
            aria-label="Bildirim saati TSİ"
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 min-w-18 px-2.5 text-[10px] font-semibold"
            disabled={!dirty || saving}
            onClick={() => void save()}
          >
            {saving ? <LoadingSpinner className="size-3.5" /> : 'Kaydet'}
          </Button>
        </div>
      </div>
    </div>
  );
}
