'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

type Teacher = {
  id: string;
  user_id: string;
  display_name?: string;
  branch?: string | null;
  mandatory_weekly_hours: number | null;
  max_extra_weekly_hours: number | null;
  max_lessons_per_day: number | null;
  min_work_days: number | null;
  max_work_days: number | null;
  allow_am_pm_gap: boolean;
  unavailable_periods: Array<{ day_of_week: number; lesson_num?: number }>;
  constraints?: { education_shift?: 'morning' | 'afternoon' | null };
};

const DAY_OPTS = [
  { v: 1, l: 'Pzt' },
  { v: 2, l: 'Sal' },
  { v: 3, l: 'Çar' },
  { v: 4, l: 'Per' },
  { v: 5, l: 'Cum' },
  { v: 6, l: 'Cmt' },
];

export default function OgretmenlerPage() {
  const { token } = useAuth();
  const { studio, refresh } = useDersDagitStudio();
  const [rows, setRows] = useState<Teacher[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [blockDay, setBlockDay] = useState(1);
  const [blockLesson, setBlockLesson] = useState(1);

  const load = useCallback(async () => {
    if (!token || !studio) return;
    setRows(await apiFetch<Teacher[]>(`/ders-dagit/studios/${studio.id}/teachers`, { token }));
  }, [token, studio]);

  useEffect(() => {
    void load();
  }, [load]);

  async function syncAll() {
    if (!token || !studio) return;
    setSyncing(true);
    try {
      await apiFetch(`/ders-dagit/studios/${studio.id}/teachers/sync`, { token, method: 'POST' });
      toast.success('Okul öğretmenleri eklendi');
      await load();
      await refresh();
    } catch {
      toast.error('Senkron başarısız');
    } finally {
      setSyncing(false);
    }
  }

  function patch(id: string, patch: Partial<Teacher>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function save(t: Teacher) {
    if (!token || !studio) return;
    await apiFetch(`/ders-dagit/studios/${studio.id}/teachers`, {
      token,
      method: 'POST',
      body: {
        id: t.id,
        user_id: t.user_id,
        branch: t.branch,
        mandatory_weekly_hours: t.mandatory_weekly_hours,
        max_extra_weekly_hours: t.max_extra_weekly_hours,
        max_lessons_per_day: t.max_lessons_per_day,
        min_work_days: t.min_work_days,
        max_work_days: t.max_work_days,
        allow_am_pm_gap: t.allow_am_pm_gap,
        unavailable_periods: t.unavailable_periods,
        constraints: t.constraints ?? {},
      },
    });
    toast.success('Kaydedildi');
    await load();
    await refresh();
  }

  function addBlock(t: Teacher) {
    patch(t.id, {
      unavailable_periods: [...t.unavailable_periods, { day_of_week: blockDay, lesson_num: blockLesson }],
    });
  }

  function removeBlock(t: Teacher, idx: number) {
    patch(t.id, {
      unavailable_periods: t.unavailable_periods.filter((_, i) => i !== idx),
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Horarium öğretmen ayarları: saat limitleri, çalışma günü, öğle arası boşluğu, müsait değil.{' '}
        <Link href="/ders-dagit/studyo/donem" className="underline">
          Dönem (öğle arası)
        </Link>
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" disabled={syncing} onClick={() => void syncAll()}>
          Okuldan öğretmen çek
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={async () => {
            if (!token || !studio) return;
            const r = await apiFetch<{ updated: number; norm: { mandatory_weekly_hours: number; max_extra_weekly_hours: number } }>(
              `/ders-dagit/studios/${studio.id}/sync-extra-lesson-params`,
              { token, method: 'POST' },
            );
            toast.success(`Maaş karşılığı norm: ${r.updated} öğretmen (${r.norm.mandatory_weekly_hours}+${r.norm.max_extra_weekly_hours} saat)`);
            await load();
          }}
        >
          Ek ders norm senkron
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={async () => {
            if (!token || !studio) return;
            const r = await apiFetch<{ block_count: number }>(`/ders-dagit/studios/${studio.id}/duty-sync`, {
              token,
              method: 'POST',
              body: {},
            });
            toast.success(`Nöbet: ${r.block_count} müsait değil slot`);
          }}
        >
          Nöbet senkron
        </Button>
        <Link href="/nobet" className="text-xs text-primary underline self-center">
          Nöbet planı
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Önce senkron yapın.</p>
      ) : (
        rows.map((t) => (
          <Card key={t.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t.display_name ?? t.user_id}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid gap-2 sm:grid-cols-4">
                <div>
                  <Label className="text-xs">Branş</Label>
                  <Input className="h-8" value={t.branch ?? ''} onChange={(e) => patch(t.id, { branch: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Zorunlu saat/hf</Label>
                  <Input
                    type="number"
                    className="h-8"
                    value={t.mandatory_weekly_hours ?? ''}
                    onChange={(e) =>
                      patch(t.id, { mandatory_weekly_hours: e.target.value ? Number(e.target.value) : null })
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Ekstra max/hf</Label>
                  <Input
                    type="number"
                    className="h-8"
                    value={t.max_extra_weekly_hours ?? ''}
                    onChange={(e) =>
                      patch(t.id, { max_extra_weekly_hours: e.target.value ? Number(e.target.value) : null })
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Max/gün</Label>
                  <Input
                    type="number"
                    className="h-8"
                    value={t.max_lessons_per_day ?? ''}
                    onChange={(e) =>
                      patch(t.id, { max_lessons_per_day: e.target.value ? Number(e.target.value) : null })
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Min çalışma günü</Label>
                  <Input
                    type="number"
                    className="h-8"
                    value={t.min_work_days ?? ''}
                    onChange={(e) => patch(t.id, { min_work_days: e.target.value ? Number(e.target.value) : null })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Max çalışma günü</Label>
                  <Input
                    type="number"
                    className="h-8"
                    value={t.max_work_days ?? ''}
                    onChange={(e) => patch(t.id, { max_work_days: e.target.value ? Number(e.target.value) : null })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Vardiya (ikili)</Label>
                  <select
                    className="h-8 w-full rounded-md border px-2 text-xs"
                    value={t.constraints?.education_shift ?? ''}
                    onChange={(e) =>
                      patch(t.id, {
                        constraints: {
                          ...(t.constraints ?? {}),
                          education_shift: (e.target.value || null) as 'morning' | 'afternoon' | null,
                        },
                      })
                    }
                  >
                    <option value="">Her iki</option>
                    <option value="morning">Sabah</option>
                    <option value="afternoon">Öğle</option>
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={t.allow_am_pm_gap}
                  onChange={(e) => patch(t.id, { allow_am_pm_gap: e.target.checked })}
                />
                Sabah/öğleden sonra arasında boşluk olabilir (kapalı = tek blok)
              </label>
              <div className="flex flex-wrap items-end gap-2">
                <select
                  className="h-8 rounded-md border px-2 text-xs"
                  value={blockDay}
                  onChange={(e) => setBlockDay(Number(e.target.value))}
                >
                  {DAY_OPTS.map((d) => (
                    <option key={d.v} value={d.v}>
                      {d.l}
                    </option>
                  ))}
                </select>
                <Input
                  type="number"
                  className="h-8 w-16"
                  min={1}
                  placeholder="saat"
                  value={blockLesson}
                  onChange={(e) => setBlockLesson(Number(e.target.value))}
                />
                <Button type="button" size="sm" variant="outline" onClick={() => addBlock(t)}>
                  + Müsait değil
                </Button>
                <Button type="button" size="sm" onClick={() => void save(t)}>
                  Kaydet
                </Button>
              </div>
              {t.unavailable_periods.length > 0 && (
                <ul className="flex flex-wrap gap-1 text-xs">
                  {t.unavailable_periods.map((b, i) => (
                    <li key={i} className="rounded bg-muted px-2 py-0.5">
                      {DAY_OPTS.find((d) => d.v === b.day_of_week)?.l ?? b.day_of_week}/
                      {b.lesson_num ?? '*'}
                      <button type="button" className="ml-1 text-destructive" onClick={() => removeBlock(t, i)}>
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
