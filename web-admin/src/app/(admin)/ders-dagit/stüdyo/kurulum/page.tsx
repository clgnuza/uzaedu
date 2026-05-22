'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import { useSchoolTimetableSettings } from '@/hooks/use-school-timetable-settings';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { ClassProfileForm } from '@/components/ders-dagit/class-profile-form';
import { SchoolProfileForm, type SchoolProfileDto } from '@/components/ders-dagit/school-profile-form';

type ClassProfile = {
  id: string;
  name: string;
  class_sections: string[];
  max_lessons_per_day: number;
  education_shift?: string | null;
};

export default function KurulumPage() {
  const { token } = useAuth();
  const { studio, overview, refresh } = useDersDagitStudio();
  const { settings: lessonSettings } = useSchoolTimetableSettings();
  const [syncing, setSyncing] = useState(false);
  const [profiles, setProfiles] = useState<ClassProfile[]>([]);
  const [suggested, setSuggested] = useState<string[]>([]);
  const [schoolProfile, setSchoolProfile] = useState<SchoolProfileDto | null>(null);

  const load = useCallback(async () => {
    if (!token || !studio) return;
    const [p, s, sp] = await Promise.all([
      apiFetch<ClassProfile[]>(`/ders-dagit/studios/${studio.id}/class-profiles`, { token }),
      apiFetch<string[]>('/ders-dagit/class-sections/suggest', { token }).catch(() => []),
      apiFetch<SchoolProfileDto>(`/ders-dagit/studios/${studio.id}/school-profile`, { token }).catch(() => null),
    ]);
    setProfiles(p);
    setSuggested(s);
    setSchoolProfile(sp);
  }, [token, studio]);

  useEffect(() => {
    void load();
  }, [load]);

  async function syncTeachers() {
    if (!token || !studio) return;
    setSyncing(true);
    try {
      await apiFetch(`/ders-dagit/studios/${studio.id}/teachers/sync`, { token, method: 'POST' });
      toast.success('Öğretmenler senkronlandı');
      await refresh();
    } catch {
      toast.error('Senkron başarısız');
    } finally {
      setSyncing(false);
    }
  }

  async function saveProfile(dto: {
    name: string;
    class_sections: string[];
    max_lessons_per_day: number;
  }) {
    if (!token || !studio) return;
    await apiFetch(`/ders-dagit/studios/${studio.id}/class-profiles`, { token, method: 'POST', body: dto });
    toast.success('Sınıf profili kaydedildi');
    await load();
    await refresh();
  }

  const c = overview?.counts;
  const schedule = lessonSettings?.lesson_schedule ?? [];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Veri özeti</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>Sınıf profili: <strong>{c?.classCount ?? 0}</strong></p>
          <p>Öğretmen: <strong>{c?.teacherCount ?? 0}</strong></p>
          <p>Ders: <strong>{c?.subjectCount ?? 0}</strong></p>
          <p>Grup: <strong>{c?.groupCount ?? 0}</strong></p>
          <p>Atama: <strong>{c?.assignmentCount ?? 0}</strong></p>
          <Button type="button" variant="secondary" size="sm" disabled={syncing || !studio} onClick={() => void syncTeachers()}>
            Öğretmenleri okuldan çek
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dönem & zaman (Faz 2)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Günlük max ders: <strong>{lessonSettings?.duty_max_lessons ?? '—'}</strong> · Mod:{' '}
            <strong>{lessonSettings?.duty_education_mode ?? 'single'}</strong>
          </p>
          <ul className="max-h-32 overflow-y-auto text-xs text-muted-foreground">
            {schedule.slice(0, 8).map((s) => (
              <li key={s.lesson_num}>
                {s.lesson_num}. ders {s.start_time}–{s.end_time}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href="/ders-dagit/stüdyo/donem">Dönem ayarları</Link>
            </Button>
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href="/ders-programi/ayarlar">Okul zaman çizelgesi</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Okul türü (MEB — Faz 33)</CardTitle>
        </CardHeader>
        <CardContent>
          <SchoolProfileForm
            initial={schoolProfile}
            onSave={async (dto) => {
              if (!token || !studio) return;
              await apiFetch(`/ders-dagit/studios/${studio.id}/school-profile`, {
                token,
                method: 'PATCH',
                body: dto,
              });
              setSchoolProfile(dto);
              toast.success('Okul profili kaydedildi');
            }}
          />
        </CardContent>
      </Card>
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Sınıf profili (Faz 3)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ClassProfileForm suggestedSections={suggested} onSave={saveProfile} />
          {profiles.length > 0 && (
            <ul className="space-y-1 border-t pt-3 text-sm">
              {profiles.map((p) => (
                <li key={p.id}>
                  <strong>{p.name}</strong> — {p.class_sections.join(', ')} (max {p.max_lessons_per_day}/gün
                  {p.education_shift ? ` · ${p.education_shift === 'morning' ? 'sabah' : 'öğle'}` : ''})
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      {(overview?.validation?.length ?? 0) > 0 && (
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Ön doğrulama</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
              {overview!.validation.map((v, i) => (
                <li key={i} className={v.severity === 'error' ? 'text-destructive' : 'text-amber-700 dark:text-amber-300'}>
                  {v.message}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
