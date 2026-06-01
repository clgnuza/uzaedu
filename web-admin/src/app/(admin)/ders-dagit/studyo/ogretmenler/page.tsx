'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  DdCard,
  CardContent,
  DdPageHeader,
  DD_PAGE,
  DD_CARD_CONTENT,
} from '@/components/ders-dagit/dd-ui';
import type { TeacherConfig } from '@/components/ders-dagit/teacher-config-types';
import { DdEntityActionBar, type EntityActionKey } from '@/components/ders-dagit/dd-entity-action-bar';
import { DdEntityWorkspace } from '@/components/ders-dagit/dd-entity-workspace';
import { DdEntityTimeDialog } from '@/components/ders-dagit/dd-entity-time-dialog';
import { TeacherEntityTable } from '@/components/ders-dagit/teacher-entity-table';
import {
  TeacherConstraintsForm,
  TeacherLimitsForm,
  teacherToDraft,
} from '@/components/ders-dagit/teacher-settings-form';
import { TeacherAvailabilityGrid } from '@/components/ders-dagit/teacher-availability-grid';
import type { TeacherDraft } from '@/components/ders-dagit/teacher-config-types';
import {
  assignmentToDraft,
  suggestRooms,
  type LessonAssignmentDraft,
  type LessonAssignmentRow,
} from '@/lib/lesson-assignment';
import { AssignedLessonsPanel } from '@/components/ders-dagit/assigned-lessons-panel';
import { LessonAssignmentDialog } from '@/components/ders-dagit/lesson-assignment-dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ListChecks, UserPlus, Users } from 'lucide-react';
import { AddStudioTeacherDialog } from '@/components/ders-dagit/add-studio-teacher-dialog';
import { DdCatalogAssignmentsHint } from '@/components/ders-dagit/dd-catalog-assignments-hint';
import { normalizeClassSectionNamesFromPool } from '@/lib/class-section-canonical';
import { useDersDagitSections } from '@/hooks/use-ders-dagit-sections';
import { useDersDagitClassProfiles } from '@/hooks/use-ders-dagit-class-profiles';

type PeriodsRes = {
  duty_max_lessons: number | null;
  work_days: number[];
};

type Assignment = LessonAssignmentRow;
type SubjectRow = { id: string; name: string; short_code?: string | null };
type RoomRow = {
  id: string;
  name: string;
  allowed_subjects?: string[] | null;
  allowed_class_sections?: string[] | null;
  allowed_teacher_ids?: string[] | null;
};
type GroupRow = { id: string; name: string; parallel_mode: string | null; member_sections: string[] };

type BulkField = 'hours' | 'availability' | 'shift';
type EditTab = 'limits' | 'constraints' | 'availability';

function mergeDraft(base: TeacherConfig, draft: TeacherDraft, fields: Set<BulkField>): Partial<TeacherConfig> {
  const patch: Partial<TeacherConfig> = {};
  if (fields.has('hours')) {
    patch.branch = draft.branch;
    patch.mandatory_weekly_hours = draft.mandatory_weekly_hours;
    patch.max_extra_weekly_hours = draft.max_extra_weekly_hours;
    patch.max_lessons_per_day = draft.max_lessons_per_day;
    patch.min_work_days = draft.min_work_days;
    patch.max_work_days = draft.max_work_days;
  }
  if (fields.has('shift')) {
    patch.allow_am_pm_gap = draft.allow_am_pm_gap;
    patch.constraints = draft.constraints;
  }
  if (fields.has('availability')) {
    patch.unavailable_periods = draft.unavailable_periods;
  }
  return { ...base, ...patch };
}

export default function OgretmenlerPage() {
  const { token } = useAuth();
  const { studio, refresh } = useDersDagitStudio();
  const { profiles: classProfiles } = useDersDagitClassProfiles(studio?.id);
  const [rows, setRows] = useState<TeacherConfig[]>([]);
  const [periods, setPeriods] = useState<PeriodsRes | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [bulkIds, setBulkIds] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<TeacherDraft | null>(null);
  const [baselineDraft, setBaselineDraft] = useState<string>('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [editTab, setEditTab] = useState<EditTab>('limits');
  const [detailOpen, setDetailOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [assignmentDraft, setAssignmentDraft] = useState<LessonAssignmentDraft | null>(null);
  const [listActiveId, setListActiveId] = useState<string | null>(null);
  const [assignPanelOpen, setAssignPanelOpen] = useState(false);
  const [bulkFields, setBulkFields] = useState<Set<BulkField>>(
    () => new Set<BulkField>(['hours', 'availability', 'shift']),
  );
  const [addOpen, setAddOpen] = useState(false);
  const assignmentsRef = useRef<HTMLElement>(null);

  const colorIndex = useMemo(() => new Map(rows.map((t, i) => [t.id, i])), [rows]);
  const active = useMemo(() => rows.find((t) => t.id === activeId) ?? null, [rows, activeId]);
  const workDays = periods?.work_days ?? [1, 2, 3, 4, 5];
  const maxLessons = periods?.duty_max_lessons ?? 8;

  const teacherNameById = useMemo(
    () => new Map(rows.map((t) => [t.user_id, t.display_name?.trim() || t.user_id.slice(0, 8)])),
    [rows],
  );
  const roomNameById = useMemo(() => new Map(rooms.map((r) => [r.id, r.name])), [rooms]);
  const extraSectionKeys = useMemo(() => assignments.flatMap((a) => a.class_sections ?? []), [assignments]);
  const { sections: allSections, reload: reloadSections } = useDersDagitSections(extraSectionKeys);
  const assignmentStatsByUserId = useMemo(() => {
    const m = new Map<string, { count: number; hours: number }>();
    for (const a of assignments) {
      for (const uid of a.teacher_ids ?? []) {
        const cur = m.get(uid) ?? { count: 0, hours: 0 };
        cur.count += 1;
        cur.hours += Number(a.weekly_hours) || 0;
        m.set(uid, cur);
      }
    }
    return m;
  }, [assignments]);

  const teacherAssignments = useMemo(() => {
    if (!active?.user_id) return [];
    return assignments.filter((a) => a.teacher_ids?.includes(active.user_id));
  }, [assignments, active?.user_id]);

  function openNewAssignment() {
    if (!active?.user_id) return;
    const teacherId = active.user_id;
    const sec = allSections[0] ?? '';
    setAssignmentDraft({
      subject_id: subjects[0]?.id ?? '',
      subject_name: subjects[0]?.name ?? '',
      primary_teacher_id: teacherId,
      co_teacher_ids: [],
      section: sec,
      joined_sections: [],
      use_joined: false,
      group_id: '',
      weekly_hours: 4,
      day_distribution: [2, 2],
      biweekly: false,
      room_mode: 'class',
      room_ids: suggestRooms('class', { section: sec, subjectName: subjects[0]?.name ?? '', teacherId, rooms }),
      place_first: false,
    });
    setListActiveId(null);
    setDialogOpen(true);
  }

  function openEditAssignment(row: Assignment) {
    setAssignmentDraft(assignmentToDraft(row, subjects));
    setListActiveId(row.id);
    setDialogOpen(true);
  }

  async function deleteAssignment(id: string) {
    if (!token || !studio) return;
    if (!window.confirm('Bu ders ataması silinsin mi?')) return;
    await apiFetch(`/ders-dagit/studios/${studio.id}/assignments/${id}`, { token, method: 'DELETE' });
    toast.success('Atama silindi');
    if (listActiveId === id) setListActiveId(null);
    await load();
  }

  const load = useCallback(async () => {
    if (!token || !studio) return;
    setLoading(true);
    try {
      const [list, per, asn, sub, rm, gr, secs] = await Promise.all([
        apiFetch<TeacherConfig[]>(`/ders-dagit/studios/${studio.id}/teachers`, { token }),
        apiFetch<PeriodsRes>(`/ders-dagit/studios/${studio.id}/periods`, { token }).catch(() => null),
        apiFetch<Assignment[]>(`/ders-dagit/studios/${studio.id}/assignments`, { token }).catch(() => []),
        apiFetch<SubjectRow[]>(`/ders-dagit/studios/${studio.id}/subjects`, { token }).catch(() => []),
        apiFetch<RoomRow[]>('/ders-dagit/rooms', { token }).catch(() => []),
        apiFetch<{ groups: GroupRow[] }>(`/ders-dagit/studios/${studio.id}/groups`, { token }).catch(() => ({
          groups: [],
        })),
        apiFetch<string[]>(`/ders-dagit/studios/${studio.id}/class-sections`, { token }).catch(() => []),
      ]);
      const pool = [...(Array.isArray(secs) ? secs : []), ...asn.flatMap((a) => a.class_sections ?? [])];
      setRows(list);
      setPeriods(per);
      setAssignments(
        asn.map((row) => ({
          ...row,
          class_sections: normalizeClassSectionNamesFromPool(row.class_sections ?? [], pool),
        })),
      );
      setSubjects(sub);
      setRooms(rm);
      setGroups(gr.groups ?? []);
      void reloadSections();
      setActiveId((prev) => prev ?? list[0]?.id ?? null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [token, studio, reloadSections]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!active) {
      setDraft(null);
      setBaselineDraft('');
      setDirty(false);
      return;
    }
    const d = teacherToDraft(active);
    setDraft(d);
    setBaselineDraft(JSON.stringify(d));
    setDirty(false);
  }, [active?.id, rows]);

  useEffect(() => {
    if (!draft) return;
    setDirty(JSON.stringify(draft) !== baselineDraft);
  }, [draft, baselineDraft]);

  function patchDraft(patch: Partial<TeacherDraft>) {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  function selectTeacher(id: string, opts?: { scrollAssignments?: boolean }) {
    if (dirty && id !== activeId && !window.confirm('Kaydedilmemiş değişiklikler silinecek. Devam?')) return;
    setActiveId(id);
    setDetailOpen(true);
    setAssignPanelOpen(true);
    if (opts?.scrollAssignments !== false) {
      requestAnimationFrame(() => {
        assignmentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }

  async function persistTeacher(t: TeacherConfig) {
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
  }

  async function saveActive() {
    if (!active || !draft) return;
    setSaving(true);
    try {
      const merged = { ...active, ...draft };
      await persistTeacher(merged);
      setRows((prev) => prev.map((t) => (t.id === merged.id ? merged : t)));
      setBaselineDraft(JSON.stringify(draft));
      setDirty(false);
      await load();
      await refresh({ force: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kayıt başarısız');
    } finally {
      setSaving(false);
    }
  }

  async function bulkApply() {
    if (!draft || bulkIds.size === 0) return;
    if (bulkFields.size === 0) {
      toast.error('En az bir alan grubu seçin');
      return;
    }
    setSaving(true);
    try {
      let n = 0;
      for (const id of bulkIds) {
        const t = rows.find((r) => r.id === id);
        if (!t) continue;
        await persistTeacher(mergeDraft(t, draft, bulkFields) as TeacherConfig);
        n++;
      }
      toast.success(`${n} öğretmene uygulandı`);
      await load();
      await refresh({ force: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Toplu kayıt başarısız');
    } finally {
      setSaving(false);
    }
  }

  async function syncAll() {
    if (!token || !studio) return;
    setSyncing(true);
    try {
      const res = await apiFetch<{ added?: number }>(`/ders-dagit/studios/${studio.id}/teachers/sync`, {
        token,
        method: 'POST',
      });
      toast.success(res?.added ? `${res.added} öğretmen eklendi` : 'Yeni öğretmen yok (liste güncel)');
      await load();
      await refresh({ force: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Senkron başarısız');
    } finally {
      setSyncing(false);
    }
  }

  async function removeFromStudio() {
    if (!token || !studio || !active) return;
    if (!window.confirm(`${active.display_name ?? 'Öğretmen'} program listesinden çıkarılsın mı?`)) return;
    setSaving(true);
    try {
      await apiFetch(`/ders-dagit/studios/${studio.id}/teachers/${active.id}`, { token, method: 'DELETE' });
      toast.success('Programdan çıkarıldı');
      setActiveId(null);
      setDetailOpen(false);
      await load();
      await refresh({ force: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silinemedi');
    } finally {
      setSaving(false);
    }
  }

  function handleAction(key: EntityActionKey) {
    if (!active && key !== 'new') return;
    switch (key) {
      case 'new':
        void syncAll();
        break;
      case 'edit':
        setDetailOpen(true);
        setEditTab('limits');
        break;
      case 'timetable':
        setTimeOpen(true);
        break;
      case 'constraints':
        setDetailOpen(true);
        setEditTab('constraints');
        break;
      case 'assign':
        setAssignPanelOpen(true);
        openNewAssignment();
        break;
      case 'save':
        void saveActive();
        break;
      case 'delete':
        void removeFromStudio();
        break;
    }
  }

  const tabBtn = (id: EditTab, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={editTab === id}
      className={cn(
        'rounded-lg px-3 py-1.5 text-sm font-medium',
        editTab === id ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-muted-foreground',
      )}
      onClick={() => setEditTab(id)}
    >
      {label}
    </button>
  );

  const teacherActions = [
    { key: 'new' as const, label: 'Okuldan çek', disabled: syncing, hidden: true },
    { key: 'edit' as const, label: 'Güncelle' },
    { key: 'timetable' as const, label: 'Zaman tablosu' },
    { key: 'assign' as const, label: 'Ders atama' },
    { key: 'constraints' as const, label: 'Kısıtlamalar' },
    { key: 'save' as const, label: 'Kaydet', disabled: !active || !dirty || saving },
    { key: 'delete' as const, label: 'Programdan çıkar', variant: 'destructive' as const },
  ];

  return (
    <div className={cn(DD_PAGE, 'min-h-0 max-w-full overflow-x-hidden')}>
      <DdPageHeader
        icon={Users}
        title="Öğretmenler"
        description="Öğretmen ayarları burada; ders atamaları Dersler/Derslikler ile ortak kayıttır."
      />

      <DdCatalogAssignmentsHint />

      <DdCard variant="sky" className="mb-2">
        <CardContent className={`${DD_CARD_CONTENT} flex flex-wrap items-center gap-2 py-2`}>
          <Button type="button" variant="secondary" size="sm" disabled={syncing || !studio} onClick={() => void syncAll()}>
            Okuldan çek
          </Button>
          <Button type="button" size="sm" disabled={!studio} onClick={() => setAddOpen(true)}>
            <UserPlus className="mr-1 size-3.5" />
            Öğretmen ekle
          </Button>
          <Button type="button" variant="ghost" size="sm" asChild>
            <Link href="/ders-dagit/studyo/donem">Dönem</Link>
          </Button>
          <Button type="button" variant="ghost" size="sm" asChild>
            <Link href="/ders-dagit/studyo/planlama-iliskileri">Planlama ilişkileri</Link>
          </Button>
        </CardContent>
      </DdCard>

      {studio && (
        <AddStudioTeacherDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          token={token}
          studioId={studio.id}
          onAdded={load}
        />
      )}

      {loading && !rows.length ? (
        <p className="text-sm text-muted-foreground">Yükleniyor…</p>
      ) : !rows.length ? (
        <DdCard variant="lavender">
          <CardContent className={DD_CARD_CONTENT}>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={() => void syncAll()}>
                Okuldan çek
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => setAddOpen(true)}>
                Öğretmen ekle
              </Button>
            </div>
          </CardContent>
        </DdCard>
      ) : (
        <>
          <DdEntityWorkspace
            title="Tanımlı öğretmenler ve dersleri"
            toolbar={
              <span className="text-xs text-muted-foreground">
                {rows.length} kayıt · çift tık = güncelle
              </span>
            }
            actions={
              <DdEntityActionBar
                kind="ogretmen"
                selectedLabel={active?.display_name ?? active?.user_id ?? null}
                actions={teacherActions}
                onAction={handleAction}
              />
            }
            selectedTitle={active?.display_name ?? active?.user_id}
            list={
              <TeacherEntityTable
                teachers={rows}
                colorIndex={colorIndex}
                activeId={activeId}
                workDays={workDays}
                maxLessons={maxLessons}
                query={query}
                onQueryChange={setQuery}
                assignmentStats={(uid) => assignmentStatsByUserId.get(uid)}
                onSelect={(id) => selectTeacher(id)}
                onDoubleClick={(id) => {
                  selectTeacher(id, { scrollAssignments: false });
                  setEditTab('limits');
                }}
                onTimeTableClick={(id) => {
                  selectTeacher(id, { scrollAssignments: false });
                  setTimeOpen(true);
                }}
              />
            }
            detailOpen={detailOpen && !!active && !!draft}
            detail={
              active && draft ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold">{active.display_name ?? active.user_id}</h3>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" disabled={!dirty || saving} onClick={() => void saveActive()}>
                        Kaydet
                      </Button>
                      {dirty && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setDraft(teacherToDraft(active));
                            setBaselineDraft(JSON.stringify(teacherToDraft(active)));
                            setDirty(false);
                          }}
                        >
                          Geri al
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2" role="tablist">
                    {tabBtn('limits', 'Saat limitleri')}
                    {tabBtn('constraints', 'Kısıtlamalar')}
                    {tabBtn('availability', 'Zaman tablosu')}
                  </div>
                  {editTab === 'limits' ? (
                    <TeacherLimitsForm draft={draft} onChange={patchDraft} schoolMaxLessons={maxLessons} />
                  ) : editTab === 'constraints' ? (
                    <TeacherConstraintsForm draft={draft} onChange={patchDraft} />
                  ) : (
                    <TeacherAvailabilityGrid
                      workDays={workDays}
                      maxLessons={maxLessons}
                      periods={draft.unavailable_periods}
                      onChange={(unavailable_periods) => patchDraft({ unavailable_periods })}
                    />
                  )}
                  {bulkIds.size > 1 && (
                    <div className="rounded-lg border border-amber-300/60 bg-amber-50/80 p-2 text-xs dark:bg-amber-950/30">
                      <p className="mb-2">
                        <strong>{bulkIds.size}</strong> öğretmene toplu uygula (seçim: liste modunda checkbox yakında)
                      </p>
                      <Button type="button" size="sm" onClick={() => void bulkApply()}>
                        Toplu uygula
                      </Button>
                    </div>
                  )}
                </div>
              ) : null
            }
            footer="Öğretmen seçince alttaki atamalara kayar · mini ızgara = zaman tablosu"
          />

          <DdEntityTimeDialog
            open={timeOpen}
            onOpenChange={setTimeOpen}
            title={active?.display_name ?? ''}
            dirty={dirty}
            saving={saving}
            onSave={() => {
              void saveActive().then(() => setTimeOpen(false));
            }}
          >
            {draft && (
              <TeacherAvailabilityGrid
                workDays={workDays}
                maxLessons={maxLessons}
                periods={draft.unavailable_periods}
                onChange={(unavailable_periods) => patchDraft({ unavailable_periods })}
              />
            )}
          </DdEntityTimeDialog>

          {active && (
            <section ref={assignmentsRef} id="dd-ogretmen-atamalar" className="scroll-mt-3">
              <DdCard variant="teal" className="overflow-hidden p-0">
                <AssignedLessonsPanel
                  wideTable
                  fillHeight
                  headerIcon={ListChecks}
                  maxHeightClass="max-h-[min(56vh,520px)]"
                  className="rounded-none border-0 shadow-none"
                  title={`Atanan dersler — ${active.display_name ?? active.user_id}`}
                  rows={teacherAssignments}
                  classProfiles={classProfiles}
                  capacityRows={assignments}
                  subjects={subjects}
                  activeId={listActiveId}
                  teacherNames={teacherNameById}
                  roomNames={roomNameById}
                  onSelect={setListActiveId}
                  onNew={() => openNewAssignment()}
                  onEdit={() => {
                    const r = teacherAssignments.find((x) => x.id === listActiveId);
                    if (r) openEditAssignment(r);
                  }}
                  onDelete={() => listActiveId && void deleteAssignment(listActiveId)}
                  toolbar={
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {teacherAssignments.length} atama
                        {assignmentStatsByUserId.get(active.user_id)?.hours
                          ? ` · ${assignmentStatsByUserId.get(active.user_id)!.hours} saat/hafta`
                          : ''}
                      </span>
                      <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" asChild>
                        <Link href={`/ders-dagit/studyo/atamalar?teacher=${encodeURIComponent(active.user_id)}`}>
                          Tüm atamalar
                        </Link>
                      </Button>
                    </div>
                  }
                />
              </DdCard>
            </section>
          )}

          {token && studio && active && (
            <LessonAssignmentDialog
              open={dialogOpen}
              onOpenChange={setDialogOpen}
              studioId={studio.id}
              token={token}
              draft={assignmentDraft}
              onDraftChange={setAssignmentDraft}
              teachers={rows.map((t) => ({ user_id: t.user_id, display_name: t.display_name }))}
              subjects={subjects}
              rooms={rooms}
              groups={groups}
              sections={allSections}
              lockTeacherId={active.user_id}
              onSaved={() => void load()}
            />
          )}
        </>
      )}
    </div>
  );
}
