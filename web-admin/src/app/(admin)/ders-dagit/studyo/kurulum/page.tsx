'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import { useSchoolTimetableSettings } from '@/hooks/use-school-timetable-settings';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
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
import { DdSetupChecklist } from '@/components/ders-dagit/dd-setup-checklist';
import { ClassProfileForm, type ClassProfileDto } from '@/components/ders-dagit/class-profile-form';
import { SchoolProfileForm, type SchoolProfileDto } from '@/components/ders-dagit/school-profile-form';
import { kurallarUrl, planlamaIliskileriUrl } from '@/lib/dd-entity-scope';
import {
  Settings2,
  Users,
  BookOpen,
  ListChecks,
  CalendarRange,
  Pencil,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { dayLabel } from '@/lib/ders-dagit-labels';
import { sortClassSections, sortValidationIssues } from '@/lib/class-section-sort';
import { schoolSetupCapabilities } from '@/lib/school-profile-capabilities';
import { toast } from 'sonner';

type ClassProfile = {
  id: string;
  name: string;
  class_sections: string[];
  max_lessons_per_day: number;
  education_shift?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  internship_days?: number[];
};

const STAT_LINKS = [
  { key: 'classCount', label: 'Şube (sınıf)', href: '/ders-dagit/studyo/kurulum', icon: Settings2 },
  { key: 'teacherCount', label: 'Öğretmen', href: '/ders-dagit/studyo/ogretmenler', icon: Users },
  { key: 'subjectCount', label: 'Ders', href: '/ders-dagit/studyo/dersler', icon: BookOpen },
  { key: 'assignmentCount', label: 'Atama', href: '/ders-dagit/studyo/atamalar', icon: ListChecks },
] as const;

export default function KurulumPage() {
  const { token } = useAuth();
  const { studio, overview, refresh } = useDersDagitStudio();
  const { settings: lessonSettings } = useSchoolTimetableSettings();
  const [syncing, setSyncing] = useState(false);
  const [profiles, setProfiles] = useState<ClassProfile[]>([]);
  const [suggested, setSuggested] = useState<string[]>([]);
  const [schoolProfile, setSchoolProfile] = useState<SchoolProfileDto | null>(null);
  const [editingProfile, setEditingProfile] = useState<ClassProfileDto | null>(null);

  const load = useCallback(async () => {
    if (!token || !studio) return;
    const [p, studioSecs, s, sp] = await Promise.all([
      apiFetch<ClassProfile[]>(`/ders-dagit/studios/${studio.id}/class-profiles`, { token }),
      apiFetch<string[]>(`/ders-dagit/studios/${studio.id}/class-sections`, { token }).catch(() => []),
      apiFetch<string[]>('/ders-dagit/class-sections/suggest', { token }).catch(() => []),
      apiFetch<SchoolProfileDto>(`/ders-dagit/studios/${studio.id}/school-profile`, { token }).catch(() => null),
    ]);
    setProfiles(p);
    setSuggested(sortClassSections([...new Set([...studioSecs, ...s].map((x) => x.trim()).filter(Boolean))]));
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
      await refresh({ force: true });
      await load();
    } catch {
      toast.error('Senkron başarısız');
    } finally {
      setSyncing(false);
    }
  }

  async function saveProfile(dto: ClassProfileDto) {
    if (!token || !studio) return;
    try {
      await apiFetch(`/ders-dagit/studios/${studio.id}/class-profiles`, {
        token,
        method: 'POST',
        body: dto,
      });
      toast.success(dto.id ? 'Profil güncellendi' : 'Sınıf profili kaydedildi');
      setEditingProfile(null);
      await load();
      await refresh({ force: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kayıt başarısız');
      throw e;
    }
  }

  async function deleteProfile(id: string, name: string) {
    if (!token || !studio) return;
    if (!confirm(`${name} profilini silmek istiyor musunuz?`)) return;
    try {
      await apiFetch(`/ders-dagit/studios/${studio.id}/class-profiles/${id}`, { token, method: 'DELETE' });
      toast.success('Profil silindi');
      if (editingProfile?.id === id) setEditingProfile(null);
      await load();
      await refresh({ force: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silinemedi');
    }
  }

  const c = overview?.counts;
  const schedule = lessonSettings?.lesson_schedule ?? [];
  const caps = useMemo(() => schoolSetupCapabilities(schoolProfile?.type), [schoolProfile?.type]);
  const sectionTakenBy = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of profiles) {
      if (editingProfile?.id === p.id) continue;
      for (const s of p.class_sections) m.set(s, p.name);
    }
    return m;
  }, [profiles, editingProfile?.id]);

  return (
    <div className={DD_PAGE}>
      <DdPageHeader
        icon={Settings2}
        title="Kurulum"
        description="Okul profili, sınıf profilleri ve hazırlık adımları — program oluşturmadan önce tamamlayın."
      />

      <DdSetupChecklist overview={overview} />

      <div className={`${DD_GRID} sm:grid-cols-2 lg:grid-cols-4`}>
        {STAT_LINKS.map(({ key, label, href, icon: Icon }) => (
          <Link key={key} href={href} className="dd-glass-panel block rounded-xl p-3 transition-transform hover:scale-[1.01]">
            <div className="flex items-center gap-2">
              <span className="dd-icon-badge !size-8 !rounded-lg">
                <Icon className="size-4" />
              </span>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="text-xl font-bold tabular-nums">{c?.[key as keyof typeof c] ?? 0}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className={`${DD_GRID} md:grid-cols-2`}>
        <DdCard variant="teal">
          <CardHeader className={DD_CARD_HEADER}>
            <CardTitle className="text-base">Hızlı işlemler</CardTitle>
          </CardHeader>
          <CardContent className={`${DD_CARD_CONTENT} flex flex-wrap gap-2`}>
            <Button type="button" variant="secondary" size="sm" disabled={syncing || !studio} onClick={() => void syncTeachers()}>
              Öğretmenleri okuldan çek
            </Button>
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href="/ders-dagit/studyo/donem">
                <CalendarRange className="mr-1 size-3.5" />
                Dönem
              </Link>
            </Button>
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href={planlamaIliskileriUrl({})}>Planlama ilişkileri</Link>
            </Button>
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href={kurallarUrl({})}>Kurallar</Link>
            </Button>
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href="/ders-programi/ayarlar">
                <ExternalLink className="mr-1 size-3.5" />
                Okul zaman çizelgesi
              </Link>
            </Button>
          </CardContent>
        </DdCard>

        <DdCard variant="sky">
          <CardHeader className={DD_CARD_HEADER}>
            <CardTitle className="text-base">Okul saatleri özeti</CardTitle>
          </CardHeader>
          <CardContent className={`${DD_CARD_CONTENT} space-y-2 text-sm`}>
            <p>
              Günlük max: <strong>{lessonSettings?.duty_max_lessons ?? '—'}</strong> · Mod:{' '}
              <strong>{lessonSettings?.duty_education_mode ?? 'single'}</strong>
            </p>
            <ul className="max-h-28 space-y-0.5 overflow-y-auto text-xs text-muted-foreground">
              {schedule.slice(0, 10).map((s) => (
                <li key={s.lesson_num}>
                  {s.lesson_num}. ders {s.start_time}–{s.end_time}
                </li>
              ))}
            </ul>
          </CardContent>
        </DdCard>
      </div>

      <DdCard className="md:col-span-2">
        <CardHeader className={DD_CARD_HEADER}>
          <CardTitle className="text-base">Okul türü ve program tipi</CardTitle>
        </CardHeader>
        <CardContent className={DD_CARD_CONTENT}>
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
              await refresh({ force: true });
            }}
          />
        </CardContent>
      </DdCard>

      <DdCard>
        <CardHeader className={DD_CARD_HEADER}>
          <CardTitle className="text-base">Sınıf profilleri</CardTitle>
        </CardHeader>
        <CardContent className={`${DD_CARD_CONTENT} space-y-4`}>
          {profiles.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Profil</th>
                    <th className="px-3 py-2">Şubeler</th>
                    <th className="px-3 py-2">Max/gün</th>
                    {caps.classProfileInternship ? <th className="px-3 py-2">Staj günleri</th> : null}
                    <th className="px-3 py-2 w-24" />
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((p) => (
                    <tr key={p.id} className="border-t">
                      <td className="px-3 py-2 align-top font-medium">{p.name}</td>
                      <td className="px-3 py-2 align-top">
                        <ul className="space-y-1 text-xs leading-snug text-muted-foreground">
                          {sortClassSections(p.class_sections).map((s) => (
                            <li key={s} className="break-words">
                              {s}
                            </li>
                          ))}
                        </ul>
                        <p className="mt-1 text-[10px] text-muted-foreground/80">{p.class_sections.length} şube</p>
                      </td>
                      <td className="px-3 py-2 tabular-nums">{p.max_lessons_per_day}</td>
                      {caps.classProfileInternship ? (
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {(p.internship_days ?? []).length
                            ? (p.internship_days ?? []).map((d) => dayLabel(d).slice(0, 3)).join(', ')
                            : '—'}
                        </td>
                      ) : null}
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="size-8"
                            title="Düzenle"
                            onClick={() => {
                              setEditingProfile({
                                id: p.id,
                                name: p.name,
                                class_sections: p.class_sections,
                                max_lessons_per_day: p.max_lessons_per_day,
                                education_shift: (p.education_shift as 'morning' | 'afternoon') ?? null,
                                start_time: p.start_time ?? undefined,
                                end_time: p.end_time ?? undefined,
                                internship_days: p.internship_days ?? [],
                              });
                              requestAnimationFrame(() =>
                                document.getElementById('dd-class-profile-form')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
                              );
                            }}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="size-8 text-destructive"
                            title="Sil"
                            onClick={() => void deleteProfile(p.id, p.name)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Henüz sınıf profili yok. Aşağıdan ekleyin.</p>
          )}

          <ClassProfileForm
            schoolType={schoolProfile?.type}
            suggestedSections={suggested}
            sectionTakenBy={sectionTakenBy}
            editing={editingProfile}
            onCancelEdit={() => setEditingProfile(null)}
            onSave={saveProfile}
          />
        </CardContent>
      </DdCard>

      {(overview?.validation?.length ?? 0) > 0 && (
        <DdCard variant="amber">
          <CardHeader className={DD_CARD_HEADER}>
            <CardTitle className="text-base">Ön doğrulama uyarıları</CardTitle>
          </CardHeader>
          <CardContent className={DD_CARD_CONTENT}>
            <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
              {sortValidationIssues(overview!.validation).map((v, i) => (
                <li key={i} className={v.severity === 'error' ? 'text-destructive' : 'text-amber-700 dark:text-amber-300'}>
                  {v.message}
                </li>
              ))}
            </ul>
            <Button type="button" variant="outline" size="sm" className="mt-3" asChild>
              <Link href="/ders-dagit/studyo/dogrulama">Doğrulama sayfası</Link>
            </Button>
          </CardContent>
        </DdCard>
      )}
    </div>
  );
}
