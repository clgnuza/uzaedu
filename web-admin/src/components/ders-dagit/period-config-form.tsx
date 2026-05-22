'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

const DAY_LABELS: Record<number, string> = {
  1: 'Pzt',
  2: 'Sal',
  3: 'Çar',
  4: 'Per',
  5: 'Cum',
  6: 'Cmt',
  7: 'Paz',
};

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
    setWorkDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
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
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Okul saat çizelgesi:{' '}
        <Link href="/ders-programi/ayarlar" className="underline">
          ders programı ayarları
        </Link>{' '}
        (max {schoolMaxLessons} ders/gün varsayılan).
      </p>
      <div>
        <Label className="mb-2 block">Çalışma günleri</Label>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5, 6, 7].map((d) => (
            <Button
              key={d}
              type="button"
              size="sm"
              variant={workDays.includes(d) ? 'default' : 'outline'}
              onClick={() => toggleDay(d)}
            >
              {DAY_LABELS[d]}
            </Button>
          ))}
        </div>
      </div>
      <div>
        <Label className="mb-2 block">Güne özel max ders (boş = okul varsayılanı)</Label>
        <div className="flex flex-wrap gap-3">
          {workDays.map((d) => (
            <div key={d} className="flex items-center gap-1 text-sm">
              <span className="w-8">{DAY_LABELS[d]}</span>
              <Input
                className="h-8 w-14"
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
      <div className="grid gap-2 sm:grid-cols-3">
        <div>
          <Label>Uzun mola (4. dersten sonra)</Label>
          <Input type="number" min={1} max={schoolMaxLessons - 1} value={breakAfter} onChange={(e) => setBreakAfter(Number(e.target.value))} />
        </div>
        <div className="sm:col-span-2">
          <Label>Etiket</Label>
          <Input value={breakLabel} onChange={(e) => setBreakLabel(e.target.value)} />
        </div>
      </div>
      <Button type="button" disabled={busy || workDays.length === 0} onClick={() => void submit()}>
        {busy ? 'Kaydediliyor…' : 'Dönem ayarlarını kaydet'}
      </Button>
    </div>
  );
}
