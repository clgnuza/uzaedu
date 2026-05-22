'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import { apiFetch } from '@/lib/api';
import {
  DdCard,
  CardContent,
  CardHeader,
  CardTitle,
  DdPageHeader,
  DD_PAGE,
  DD_GRID,
  DD_CARD_HEADER,
  DD_CARD_CONTENT,
} from '@/components/ders-dagit/dd-ui';
import { PeriodConfigForm, type PeriodConfig } from '@/components/ders-dagit/period-config-form';
import { DualEducationForm, type DualEducationConfig } from '@/components/ders-dagit/dual-education-form';
import { CalendarRange } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { dayLabel } from '@/lib/ders-dagit-labels';
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

function ScheduleTable({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ lesson_num: number; start_time: string; end_time: string }>;
}) {
  if (!rows.length) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">{title}</p>
      <div className="max-h-40 overflow-y-auto rounded-lg border">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted/80">
            <tr>
              <th className="px-2 py-1 text-left font-medium">Ders</th>
              <th className="px-2 py-1 text-left font-medium">Başlangıç</th>
              <th className="px-2 py-1 text-left font-medium">Bitiş</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.lesson_num} className="border-t">
                <td className="px-2 py-1">{s.lesson_num}</td>
                <td className="px-2 py-1 font-mono">{s.start_time}</td>
                <td className="px-2 py-1 font-mono">{s.end_time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function DonemPage() {
  const { token } = useAuth();
  const { studio } = useDersDagitStudio();
  const [data, setData] = useState<PeriodsRes | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token || !studio) return;
    setLoading(true);
    try {
      setData(await apiFetch<PeriodsRes>(`/ders-dagit/studios/${studio.id}/periods`, { token }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Dönem ayarları yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [token, studio]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(period: PeriodConfig) {
    if (!token || !studio) return;
    try {
      await apiFetch(`/ders-dagit/studios/${studio.id}/periods`, {
        token,
        method: 'PATCH',
        body: { period, work_days: period.work_days, dual_education: data?.dual_education },
      });
      toast.success('Dönem kaydedildi');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kayıt başarısız');
      throw e;
    }
  }

  async function saveDual(dual: DualEducationConfig) {
    if (!token || !studio) return;
    try {
      await apiFetch(`/ders-dagit/studios/${studio.id}/periods`, {
        token,
        method: 'PATCH',
        body: { dual_education: dual },
      });
      toast.success('İkili eğitim kaydedildi');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kayıt başarısız');
      throw e;
    }
  }

  const max = data?.duty_max_lessons ?? 8;
  const workDays = data?.work_days ?? data?.studio_period?.work_days ?? [1, 2, 3, 4, 5];
  const dualOn = data?.dual_education?.enabled ?? false;

  return (
    <div className={DD_PAGE}>
      <DdPageHeader
        icon={CalendarRange}
        title="Dönem"
        description={
          studio
            ? `${studio.academic_year}${studio.name ? ` · ${studio.name}` : ''} — çalışma günleri, öğle arası ve ikili eğitim bu stüdyoya özel kaydedilir.`
            : 'Çalışma günleri, öğle arası ve ikili eğitim ayarları.'
        }
      />

      {loading && !data && <p className="text-sm text-muted-foreground">Yükleniyor…</p>}

      {data && (
        <>
          <div className={`${DD_GRID} md:grid-cols-2`}>
            <DdCard variant="sky">
              <CardHeader className={DD_CARD_HEADER}>
                <CardTitle className="text-base">Okul zaman çizelgesi</CardTitle>
                <p className="text-xs text-muted-foreground">Salt okunur — değişiklik okul ayarlarından yapılır.</p>
              </CardHeader>
              <CardContent className={`${DD_CARD_CONTENT} space-y-3`}>
                <p className="text-sm">
                  Günlük max ders: <strong>{max}</strong>
                  {data.duty_education_mode && (
                    <>
                      {' '}
                      · Mod: <strong>{data.duty_education_mode === 'dual' ? 'İkili' : 'Tek vardiya'}</strong>
                    </>
                  )}
                </p>
                <ScheduleTable title="Sabah vardiyası" rows={data.lesson_schedule ?? []} />
                <ScheduleTable title="Öğle vardiyası" rows={data.lesson_schedule_pm ?? []} />
                <Button type="button" variant="outline" size="sm" asChild>
                  <Link href="/ders-programi/ayarlar">Okul zaman çizelgesini düzenle</Link>
                </Button>
              </CardContent>
            </DdCard>

            <DdCard variant="teal">
              <CardHeader className={DD_CARD_HEADER}>
                <CardTitle className="text-base">Özet</CardTitle>
              </CardHeader>
              <CardContent className={`${DD_CARD_CONTENT} space-y-3 text-sm`}>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Çalışma günleri</p>
                  <p>{workDays.map((d) => dayLabel(d)).join(', ') || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Öğle arası</p>
                  <p>
                    {data.studio_period?.long_breaks?.[0]
                      ? `${data.studio_period.long_breaks[0].after_lesson}. dersten sonra — ${data.studio_period.long_breaks[0].label ?? 'Öğle arası'}`
                      : `${data.pm_first_lesson ? data.pm_first_lesson - 1 : 4}. dersten sonra (varsayılan)`}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">İkili eğitim</p>
                  <p>
                    {dualOn
                      ? `Açık · öğle 1. ders: ${data.dual_education?.pm_first_lesson ?? data.pm_first_lesson}`
                      : 'Kapalı'}
                  </p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => void load()}>
                  Yenile
                </Button>
              </CardContent>
            </DdCard>
          </div>

          <DdCard variant="indigo">
            <CardHeader className={DD_CARD_HEADER}>
              <CardTitle className="text-base">Program merkezi dönem ayarları</CardTitle>
            </CardHeader>
            <CardContent className={DD_CARD_CONTENT}>
              <PeriodConfigForm
                initial={{
                  work_days: workDays,
                  lessons_per_day_by_dow: data.studio_period?.lessons_per_day_by_dow,
                  long_breaks: data.studio_period?.long_breaks,
                }}
                schoolMaxLessons={max}
                onSave={save}
              />
            </CardContent>
          </DdCard>

          <DdCard variant="lavender">
            <CardHeader className={DD_CARD_HEADER}>
              <CardTitle className="text-base">İkili eğitim</CardTitle>
              <p className="text-xs text-muted-foreground">
                Sabah/öğle vardiyası; sınıf profili ve öğretmen vardiya etiketleriyle birlikte kullanılır.
              </p>
            </CardHeader>
            <CardContent className={DD_CARD_CONTENT}>
              <DualEducationForm
                initial={data.dual_education ?? { enabled: false }}
                pmFirstDefault={data.pm_first_lesson ?? 6}
                pmScheduleCount={data.lesson_schedule_pm?.length ?? 0}
                onSave={saveDual}
              />
            </CardContent>
          </DdCard>
        </>
      )}
    </div>
  );
}
