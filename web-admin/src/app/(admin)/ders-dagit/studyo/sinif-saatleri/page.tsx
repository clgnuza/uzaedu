'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import { apiFetch } from '@/lib/api';
import { DdPageHeader, DD_PAGE, DD_CARD_CONTENT } from '@/components/ders-dagit/dd-ui';
import { Grid3x3 } from 'lucide-react';
import { DdEntityActionBar, type EntityActionKey } from '@/components/ders-dagit/dd-entity-action-bar';
import { DdEntityWorkspace } from '@/components/ders-dagit/dd-entity-workspace';
import { DdEntityTimeDialog } from '@/components/ders-dagit/dd-entity-time-dialog';
import { SectionEntityTable } from '@/components/ders-dagit/section-entity-table';
import { SectionScheduleGrid } from '@/components/ders-dagit/section-schedule-grid';
import { Button } from '@/components/ui/button';
import { normalizeSectionSchedulesResponse } from '@/lib/class-section-schedules-normalize';
import { emptySchedule, scheduleForSchoolType, type SectionScheduleConfig } from '@/lib/section-schedule';
import { toast } from 'sonner';
import type { PeriodConfig } from '@/components/ders-dagit/period-config-form';
import type { SchoolProfileDto } from '@/components/ders-dagit/school-profile-form';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { sectionsMatch } from '@/lib/class-section-canonical';
import { atamalarUrl, planlamaIliskileriUrl } from '@/lib/dd-entity-scope';
import { DdCatalogAssignmentsHint } from '@/components/ders-dagit/dd-catalog-assignments-hint';
import { useDersDagitClassProfiles } from '@/hooks/use-ders-dagit-class-profiles';
import {
  buildHoursBySection,
  sectionAssignmentStatus,
  type SectionAssignmentStatus,
} from '@/lib/assigned-lessons-summary';
import type { LessonAssignmentRow } from '@/lib/lesson-assignment';

type SchedulesRes = {
  sections: string[];
  schedules: Record<string, SectionScheduleConfig>;
};

type PeriodsRes = {
  duty_max_lessons: number | null;
  work_days: number[];
  studio_period: PeriodConfig;
};

export default function SinifSaatleriPage() {
  const { token } = useAuth();
  const { studio } = useDersDagitStudio();
  const { profiles: classProfiles } = useDersDagitClassProfiles(studio?.id);
  const [assignments, setAssignments] = useState<LessonAssignmentRow[]>([]);
  const searchParams = useSearchParams();
  const [sections, setSections] = useState<string[]>([]);
  const [schedules, setSchedules] = useState<Record<string, SectionScheduleConfig>>({});
  const [section, setSection] = useState('');
  const [draft, setDraft] = useState<SectionScheduleConfig>(emptySchedule());
  const [baseline, setBaseline] = useState('');
  const [periods, setPeriods] = useState<PeriodsRes | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copyTargets, setCopyTargets] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [detailOpen, setDetailOpen] = useState(true);
  const [timeOpen, setTimeOpen] = useState(false);
  const [schoolType, setSchoolType] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !studio) return;
    setLoading(true);
    try {
      const [sched, per, sp, asn] = await Promise.all([
        apiFetch<SchedulesRes>(`/ders-dagit/studios/${studio.id}/section-schedules`, { token }),
        apiFetch<PeriodsRes>(`/ders-dagit/studios/${studio.id}/periods`, { token }).catch(() => null),
        apiFetch<SchoolProfileDto>(`/ders-dagit/studios/${studio.id}/school-profile`, { token }).catch(() => null),
        apiFetch<LessonAssignmentRow[]>(`/ders-dagit/studios/${studio.id}/assignments`, { token }).catch(
          () => [],
        ),
      ]);
      setAssignments(asn);
      setSchoolType(sp?.type ?? null);
      const norm = normalizeSectionSchedulesResponse(sched.sections, sched.schedules);
      setSections(norm.sections);
      setSchedules(norm.schedules);
      setPeriods(per);
      setSection((prev) => {
        if (prev && norm.sections.includes(prev)) return prev;
        return norm.sections[0] || '';
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [token, studio]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const s = scheduleForSchoolType(schedules[section] ?? emptySchedule(), schoolType);
    setDraft(s);
    setBaseline(JSON.stringify(s));
    setCopyTargets([]);
  }, [section, schedules, schoolType]);

  useEffect(() => {
    if (loading) return;
    const secParam = searchParams.get('section')?.trim();
    if (secParam && sections.length) {
      const match = sections.find((s) => sectionsMatch(s, secParam));
      if (match) {
        setSection(match);
        setDetailOpen(true);
      }
    }
    if (searchParams.get('time') === '1') setTimeOpen(true);
  }, [loading, searchParams, sections]);

  const dirty = JSON.stringify(draft) !== baseline;
  const workDays = periods?.work_days ?? [1, 2, 3, 4, 5];
  const schoolMax = periods?.duty_max_lessons ?? 8;
  const longBreaks = periods?.studio_period?.long_breaks;
  const otherSections = sections.filter((s) => s !== section);
  const schedulesForList = useMemo(() => {
    if (!section) return schedules;
    return { ...schedules, [section]: draft };
  }, [schedules, section, draft]);

  const assignmentStatusBySection = useMemo(() => {
    const hoursBySection = buildHoursBySection(assignments);
    const out: Record<string, SectionAssignmentStatus> = {};
    for (const sec of sections) {
      out[sec] = sectionAssignmentStatus(sec, hoursBySection, classProfiles);
    }
    return out;
  }, [assignments, sections, classProfiles]);

  function selectSection(sec: string) {
    if (dirty && sec !== section && !window.confirm('Kaydedilmemiş değişiklikler silinecek. Devam?')) return;
    setSection(sec);
    setDetailOpen(true);
  }

  async function saveCurrent() {
    if (!token || !studio || !section) return;
    setSaving(true);
    try {
      const res = await apiFetch<SchedulesRes>(`/ders-dagit/studios/${studio.id}/section-schedules`, {
        token,
        method: 'PATCH',
        body: { section, schedule: scheduleForSchoolType(draft, schoolType) },
      });
      const norm = normalizeSectionSchedulesResponse(res.sections, res.schedules);
      const saved = scheduleForSchoolType(norm.schedules[section] ?? draft, schoolType);
      setSections(norm.sections);
      setSchedules(norm.schedules);
      setDraft(saved);
      setBaseline(JSON.stringify(saved));
      toast.success(`${section} kaydedildi`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kayıt başarısız');
    } finally {
      setSaving(false);
    }
  }

  async function copyToOthers() {
    if (!token || !studio || !copyTargets.length) return;
    setSaving(true);
    try {
      for (const sec of copyTargets) {
        if (sec === section) continue;
        await apiFetch(`/ders-dagit/studios/${studio.id}/section-schedules`, {
          token,
          method: 'PATCH',
          body: { section: sec, schedule: scheduleForSchoolType(draft, schoolType) },
        });
      }
      const resRaw = await apiFetch<SchedulesRes>(`/ders-dagit/studios/${studio.id}/section-schedules`, { token });
      const res = normalizeSectionSchedulesResponse(resRaw.sections, resRaw.schedules);
      setSections(res.sections);
      setSchedules(res.schedules);
      toast.success(`${copyTargets.length} şubeye kopyalandı`);
      setCopyTargets([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kopyalama başarısız');
    } finally {
      setSaving(false);
    }
  }

  function handleAction(key: EntityActionKey) {
    if (!section && key !== 'new') return;
    switch (key) {
      case 'edit':
        setDetailOpen(true);
        break;
      case 'timetable':
        setDetailOpen(true);
        setTimeOpen(true);
        break;
      case 'save':
        void saveCurrent();
        break;
      case 'constraints':
        if (typeof window !== 'undefined') {
          window.location.href = planlamaIliskileriUrl({ section });
        }
        break;
      case 'assign':
        if (typeof window !== 'undefined') {
          window.location.href = atamalarUrl({ section });
        }
        break;
      case 'new':
        window.location.href = '/ders-dagit/studyo/kurulum';
        break;
      default:
        break;
    }
  }

  const sectionActions = [
    { key: 'new' as const, label: 'Yeni şube (kurulum)' },
    { key: 'edit' as const, label: 'Güncelle' },
    { key: 'timetable' as const, label: 'Zaman tablosu' },
    { key: 'assign' as const, label: 'Ders atama' },
    { key: 'constraints' as const, label: 'Kısıtlamalar' },
    { key: 'save' as const, label: 'Kaydet', disabled: !section || !dirty || saving },
  ];

  return (
    <div className={DD_PAGE}>
      <DdPageHeader
        icon={Grid3x3}
        title="Sınıflar"
        description="Şube listesi kurulum + ders kataloğu + atamalardan gelir; atama kaydı burada değişmez."
      />

      <DdCatalogAssignmentsHint />

      {loading && !sections.length ? (
        <p className="text-sm text-muted-foreground">Yükleniyor…</p>
      ) : !sections.length ? (
        <p className="text-sm">
          <Link href="/ders-dagit/studyo/kurulum" className="text-primary underline">
            Kurulum
          </Link>
          ’da şube ekleyin.
        </p>
      ) : (
        <>
          <DdEntityWorkspace
            title="Tanımlı sınıflar"
            toolbar={<span className="dd-entity-count">{sections.length} şube</span>}
            actions={
              <DdEntityActionBar
                kind="sinif"
                selectedLabel={section || null}
                actions={sectionActions}
                onAction={handleAction}
              />
            }
            selectedTitle={section || undefined}
            list={
              <SectionEntityTable
                sections={sections}
                schedules={schedulesForList}
                activeSection={section || null}
                workDays={workDays}
                schoolMaxLessons={schoolMax}
                studioLessonsByDow={periods?.studio_period?.lessons_per_day_by_dow}
                longBreaks={longBreaks}
                query={query}
                onQueryChange={setQuery}
                onSelect={selectSection}
                onTimeTableClick={(sec) => {
                  selectSection(sec);
                  setTimeOpen(true);
                }}
                assignmentStatusBySection={assignmentStatusBySection}
              />
            }
            detailOpen={detailOpen && !!section}
            detail={
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">{section}</h3>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" disabled={!dirty || saving} onClick={() => void saveCurrent()}>
                      Kaydet
                    </Button>
                    {dirty && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const s = schedules[section] ?? emptySchedule();
                          setDraft(s);
                          setBaseline(JSON.stringify(s));
                        }}
                      >
                        Geri al
                      </Button>
                    )}
                  </div>
                </div>
                <SectionScheduleGrid
                  schoolType={schoolType}
                  workDays={workDays}
                  schoolMaxLessons={schoolMax}
                  studioLessonsByDow={periods?.studio_period?.lessons_per_day_by_dow}
                  longBreaks={longBreaks}
                  schedule={draft}
                  onChange={setDraft}
                />
                {otherSections.length > 0 && (
                  <div className="space-y-2 border-t pt-3">
                    <p className="text-xs font-medium">Diğer şubelere kopyala</p>
                    <div className="flex max-h-24 flex-wrap gap-2 overflow-y-auto">
                      {otherSections.map((s) => (
                        <label key={s} className="flex items-center gap-1 rounded border px-2 py-1 text-xs">
                          <input
                            type="checkbox"
                            checked={copyTargets.includes(s)}
                            onChange={() =>
                              setCopyTargets((prev) =>
                                prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
                              )
                            }
                          />
                          {s}
                        </label>
                      ))}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={!copyTargets.length || saving}
                      onClick={() => void copyToOthers()}
                    >
                      Kopyala ({copyTargets.length})
                    </Button>
                  </div>
                )}
              </div>
            }
            footer="Hücre tıkla = boyama · gün satırındaki +/− = o günün ders sayısı"
          />

          <DdEntityTimeDialog
            open={timeOpen}
            onOpenChange={setTimeOpen}
            title={section}
            dirty={dirty}
            saving={saving}
            onSave={() => void saveCurrent().then(() => setTimeOpen(false))}
            onApplyAll={
              otherSections.length
                ? () => {
                    setCopyTargets(otherSections);
                    toast.info('Alttaki panelden hedef şubeleri işaretleyip Kopyala kullanın');
                  }
                : undefined
            }
          >
            <SectionScheduleGrid
              schoolType={schoolType}
              workDays={workDays}
              schoolMaxLessons={schoolMax}
              studioLessonsByDow={periods?.studio_period?.lessons_per_day_by_dow}
              longBreaks={longBreaks}
              schedule={draft}
              onChange={setDraft}
            />
          </DdEntityTimeDialog>
        </>
      )}
    </div>
  );
}
