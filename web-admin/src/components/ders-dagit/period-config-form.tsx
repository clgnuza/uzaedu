'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { dayLabel } from '@/lib/ders-dagit-labels';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export type PeriodConfig = {
  label?: string;
  work_days: number[];
  lessons_per_day_by_dow?: Record<string, number>;
  long_breaks?: Array<{ after_lesson: number; label?: string; blocked_slots?: number }>;
};

type Props = {
  initial: PeriodConfig;
  schoolMaxLessons: number;
  onSave: (p: PeriodConfig) => Promise<void>;
};

const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7] as const;

export function PeriodConfigForm({ initial, schoolMaxLessons, onSave }: Props) {
  const [workDays, setWorkDays] = useState<number[]>(initial.work_days ?? [1, 2, 3, 4, 5]);
  const [perDay, setPerDay] = useState<Record<string, string>>({});
  const [breakAfter, setBreakAfter] = useState(4);
  const [breakLabel, setBreakLabel] = useState('Öğle arası');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setWorkDays(initial.work_days ?? [1, 2, 3, 4, 5]);
    const map: Record<string, string> = {};
    for (const [k, v] of Object.entries(initial.lessons_per_day_by_dow ?? {})) {
      map[k] = String(v);
    }
    setPerDay(map);
    const lb = initial.long_breaks?.[0];
    if (lb) {
      setBreakAfter(lb.after_lesson);
      setBreakLabel(lb.label ?? 'Öğle arası');
    }
  }, [initial]);

  function toggleDay(d: number) {
    setWorkDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b)));
  }

  async function submit() {
    setBusy(true);
    try {
      const lessons_per_day_by_dow: Record<string, number> = {};
      for (const d of workDays) {
        const raw = perDay[String(d)];
        if (raw?.trim()) lessons_per_day_by_dow[String(d)] = Math.min(schoolMaxLessons, Number(raw));
      }
      await onSave({
        work_days: workDays,
        lessons_per_day_by_dow,
        long_breaks: [{ after_lesson: breakAfter, label: breakLabel, blocked_slots: 1 }],
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground">
        Okul üst sınırı: <strong>{schoolMaxLessons}</strong> ders/gün. Saat dilimleri{' '}
        <Link href="/ders-programi/ayarlar" className="underline">
          ders programı ayarları
        </Link>
        ndan gelir.
      </p>

      <div>
        <Label className="mb-2 block text-sm">Çalışma günleri</Label>
        <div className="flex flex-wrap gap-2">
          {ALL_DAYS.map((d) => (
            <Button
              key={d}
              type="button"
              size="sm"
              variant={workDays.includes(d) ? 'default' : 'outline'}
              className={cn('min-w-[3.25rem]', d >= 6 && !workDays.includes(d) && 'opacity-70')}
              onClick={() => toggleDay(d)}
            >
              {dayLabel(d).slice(0, 3)}
            </Button>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">Seçili: {workDays.map((d) => dayLabel(d)).join(', ') || '—'}</p>
      </div>

      {workDays.length > 0 && (
        <div>
          <Label className="mb-2 block text-sm">Güne özel max ders</Label>
          <p className="mb-2 text-[11px] text-muted-foreground">Boş bırakırsanız okul varsayılanı ({schoolMaxLessons}) kullanılır.</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {workDays.map((d) => (
              <div key={d} className="flex items-center gap-2 rounded-lg border bg-muted/20 px-2 py-1.5">
                <span className="w-20 shrink-0 text-xs font-medium">{dayLabel(d)}</span>
                <Input
                  className="h-8"
                  type="number"
                  min={1}
                  max={schoolMaxLessons}
                  placeholder={String(schoolMaxLessons)}
                  value={perDay[String(d)] ?? ''}
                  onChange={(e) => setPerDay((p) => ({ ...p, [String(d)]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label className="text-sm">Öğle arası (kaçıncı dersten sonra)</Label>
          <Input
            type="number"
            min={1}
            max={Math.max(1, schoolMaxLessons - 1)}
            value={breakAfter}
            onChange={(e) => setBreakAfter(Number(e.target.value))}
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Örn. 4 → <strong>4. ders</strong> ile <strong>5. ders</strong> arasında öğle sütunu.
          </p>
        </div>
        <div className="sm:col-span-2">
          <Label className="text-sm">Öğle arası etiketi</Label>
          <Input value={breakLabel} onChange={(e) => setBreakLabel(e.target.value)} placeholder="Öğle arası" />
        </div>
      </div>

      <Button type="button" disabled={busy || workDays.length === 0} onClick={() => void submit()}>
        {busy ? 'Kaydediliyor…' : 'Dönem ayarlarını kaydet'}
      </Button>
    </div>
  );
}
