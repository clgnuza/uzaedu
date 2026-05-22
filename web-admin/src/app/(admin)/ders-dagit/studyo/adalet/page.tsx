'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import { apiFetch } from '@/lib/api';
import { DdCard, CardContent, CardHeader, CardTitle, DD_PAGE, DD_GRID, DD_CARD_HEADER, DD_CARD_CONTENT, ddVariantAt } from '@/components/ders-dagit/dd-ui';

type Fairness = {
  ready: boolean;
  message?: string;
  avg_lessons_per_teacher?: number;
  monday_friday_slot_ratio?: number;
  hint?: string | null;
  teacher_stats?: Array<{
    teacher_id: string;
    lesson_count: number;
    work_day_count: number;
    gap_count: number;
    deviation_from_avg: number;
  }>;
};

export default function AdaletPage() {
  const { token } = useAuth();
  const { studio } = useDersDagitStudio();
  const [data, setData] = useState<Fairness | null>(null);

  useEffect(() => {
    if (!token || !studio) return;
    void apiFetch<Fairness>(`/ders-dagit/studios/${studio.id}/fairness`, { token }).then(setData);
  }, [token, studio]);

  if (!data?.ready) {
    return <p className="text-sm text-muted-foreground">{data?.message ?? 'Yükleniyor…'}</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        İdare içi özet — öğretmen isimleri gösterilmez (mobbing riski). Branş ortalamasından sapma ve boşluk sayısı.
      </p>
      {data.hint && (
        <p className="rounded-lg border border-amber-300/50 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          {data.hint}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <DdCard>
          <CardHeader>
            <CardTitle className="text-base">Ortalama</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{data.avg_lessons_per_teacher} saat</CardContent>
        </DdCard>
        <DdCard>
          <CardHeader>
            <CardTitle className="text-base">Pazartesi–Cuma ders oranı</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">%{data.monday_friday_slot_ratio}</CardContent>
        </DdCard>
      </div>
      <DdCard>
        <CardHeader>
          <CardTitle className="text-base">Öğretmen istatistikleri (anonim id)</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="max-h-64 space-y-1 overflow-y-auto font-mono text-xs">
            {(data.teacher_stats ?? []).map((t) => (
              <li key={t.teacher_id}>
                {t.teacher_id.slice(0, 8)}… · {t.lesson_count} ders · {t.work_day_count} gün · {t.gap_count} boşluk · sapma{' '}
                {t.deviation_from_avg > 0 ? '+' : ''}
                {t.deviation_from_avg}
              </li>
            ))}
          </ul>
        </CardContent>
      </DdCard>
    </div>
  );
}
