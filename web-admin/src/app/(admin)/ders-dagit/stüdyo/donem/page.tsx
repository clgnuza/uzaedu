'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PeriodConfigForm, type PeriodConfig } from '@/components/ders-dagit/period-config-form';
import { DualEducationForm, type DualEducationConfig } from '@/components/ders-dagit/dual-education-form';
import { toast } from 'sonner';

type PeriodsRes = {
  duty_max_lessons: number | null;
  duty_education_mode: string;
  lesson_schedule: Array<{ lesson_num: number; start_time: string; end_time: string }>;
  lesson_schedule_pm?: Array<{ lesson_num: number; start_time: string; end_time: string }>;
  studio_period: PeriodConfig;
  work_days: number[];
  dual_education: DualEducationConfig;
  pm_first_lesson: number;
};

export default function DonemPage() {
  const { token } = useAuth();
  const { studio } = useDersDagitStudio();
  const [data, setData] = useState<PeriodsRes | null>(null);

  const load = useCallback(async () => {
    if (!token || !studio) return;
    setData(await apiFetch<PeriodsRes>(`/ders-dagit/studios/${studio.id}/periods`, { token }));
  }, [token, studio]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(period: PeriodConfig) {
    if (!token || !studio) return;
    await apiFetch(`/ders-dagit/studios/${studio.id}/periods`, {
      token,
      method: 'PATCH',
      body: { period, work_days: period.work_days, dual_education: data?.dual_education },
    });
    toast.success('Dönem kaydedildi');
    await load();
  }

  async function saveDual(dual: DualEducationConfig) {
    if (!token || !studio) return;
    await apiFetch(`/ders-dagit/studios/${studio.id}/periods`, {
      token,
      method: 'PATCH',
      body: { dual_education: dual },
    });
    toast.success('İkili eğitim kaydedildi');
    await load();
  }

  const max = data?.duty_max_lessons ?? 8;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Horarium Dönemler: çalışma günleri, uzun mola, bazı günlerde daha az ders.{' '}
        <a href="https://horarium.ai/tr/help" className="underline" target="_blank" rel="noreferrer">
          yardım
        </a>
      </p>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Okul saat çizelgesi (salt okunur)</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <p className="text-xs font-medium text-muted-foreground">Sabah</p>
          <ul className="max-h-32 overflow-y-auto text-xs text-muted-foreground">
            {(data?.lesson_schedule ?? []).map((s) => (
              <li key={s.lesson_num}>
                {s.lesson_num}. {s.start_time}–{s.end_time}
              </li>
            ))}
          </ul>
          {(data?.lesson_schedule_pm?.length ?? 0) > 0 && (
            <>
              <p className="mt-2 text-xs font-medium text-muted-foreground">Öğle</p>
              <ul className="max-h-32 overflow-y-auto text-xs text-muted-foreground">
                {data!.lesson_schedule_pm!.map((s) => (
                  <li key={`pm-${s.lesson_num}`}>
                    {s.lesson_num}. {s.start_time}–{s.end_time}
                  </li>
                ))}
              </ul>
            </>
          )}
          <Link href="/ders-programi/ayarlar" className="mt-2 inline-block text-xs underline">
            Okul zaman çizelgesini düzenle
          </Link>
        </CardContent>
      </Card>
      {data && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">DersDağıt dönem ayarları</CardTitle>
          </CardHeader>
          <CardContent>
            <PeriodConfigForm
              initial={{
                work_days: data.work_days ?? data.studio_period?.work_days ?? [1, 2, 3, 4, 5],
                lessons_per_day_by_dow: data.studio_period?.lessons_per_day_by_dow,
                long_breaks: data.studio_period?.long_breaks,
              }}
              schoolMaxLessons={max}
              onSave={save}
            />
            <DualEducationForm
              initial={data.dual_education ?? { enabled: false }}
              pmFirstDefault={data.pm_first_lesson ?? 6}
              pmScheduleCount={data.lesson_schedule_pm?.length ?? 0}
              onSave={saveDual}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
