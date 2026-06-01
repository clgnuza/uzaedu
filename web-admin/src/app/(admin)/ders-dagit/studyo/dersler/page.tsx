'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import { useDersDagitSections } from '@/hooks/use-ders-dagit-sections';
import { useDersDagitClassProfiles } from '@/hooks/use-ders-dagit-class-profiles';
import { useStudioValidation } from '@/hooks/use-studio-validation';
import { apiFetch } from '@/lib/api';
import {
  assignmentToDraft,
  suggestRooms,
  type LessonAssignmentDraft,
  type LessonAssignmentRow,
} from '@/lib/lesson-assignment';
import { inferDayDistribution } from '@/lib/lesson-distribution';
import { AssignedLessonsPanel } from '@/components/ders-dagit/assigned-lessons-panel';
import { LessonAssignmentDialog } from '@/components/ders-dagit/lesson-assignment-dialog';
import { sectionsMatch } from '@/lib/class-section-canonical';
import {
  canonicalizeSectionList,
  computeDerslerWarnings,
  filterAssignments,
  mergeRecordBySectionAlias,
  schoolTypeLabel,
  subjectTotalHours,
  type DerslerAssignment,
  type DerslerSubject,
} from '@/lib/dersler-studio';
import { CatalogImportPanel } from '@/components/ders-dagit/catalog-import-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DdCard,
  CardContent,
  CardHeader,
  CardTitle,
  DdPageHeader,
  DD_PAGE,
  DD_CARD_HEADER,
  DD_CARD_CONTENT,
  DdSelect,
} from '@/components/ders-dagit/dd-ui';
import { DdEntityActionBar, type EntityActionKey } from '@/components/ders-dagit/dd-entity-action-bar';
import { DdEntityWorkspace } from '@/components/ders-dagit/dd-entity-workspace';
import { SchoolPlanImportPanel } from '@/components/ders-dagit/school-plan-import-panel';
import { SubjectEntityTable } from '@/components/ders-dagit/subject-entity-table';
import { SubjectSectionHoursTable } from '@/components/ders-dagit/subject-section-hours-table';
import { DdCatalogAssignmentsHint } from '@/components/ders-dagit/dd-catalog-assignments-hint';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { AlertTriangle, BookOpen, ListChecks, Plus, RefreshCw, Search } from 'lucide-react';

type Teacher = { user_id: string; display_name?: string };
type Room = {
  id: string;
  name: string;
  allowed_subjects?: string[] | null;
  allowed_class_sections?: string[] | null;
  allowed_teacher_ids?: string[] | null;
};
type Group = {
  id: string;
  name: string;
  parallel_mode: string | null;
  member_sections: string[];
};

export default function DerslerPage() {
  const { token } = useAuth();
  const { studio, overview } = useDersDagitStudio();
  const { profiles: classProfiles } = useDersDagitClassProfiles(studio?.id);
  const { issues: validationIssues } = useStudioValidation(studio?.id, {
    initialIssues: overview?.validation,
  });

  const [subjects, setSubjects] = useState<DerslerSubject[]>([]);
  const [assignments, setAssignments] = useState<DerslerAssignment[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [schoolType, setSchoolType] = useState('anadolu_lise');
  const [loading, setLoading] = useState(true);

  const [subjectQuery, setSubjectQuery] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [sectionFilter, setSectionFilter] = useState('');

  const [groups, setGroups] = useState<Group[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [assignmentDraft, setAssignmentDraft] = useState<LessonAssignmentDraft | null>(null);
  const [listActiveId, setListActiveId] = useState<string | null>(null);

  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSection, setNewSection] = useState('');
  const [newHours, setNewHours] = useState(4);
  const [subjectDraftName, setSubjectDraftName] = useState('');
  const [subjectDraftCode, setSubjectDraftCode] = useState('');
  const [subjectDraftHours, setSubjectDraftHours] = useState<Record<string, number>>({});
  const [subjectDetailOpen, setSubjectDetailOpen] = useState(false);
  const [subjectSaving, setSubjectSaving] = useState(false);
  const [catalogSyncing, setCatalogSyncing] = useState(false);
  const [assignmentQuery, setAssignmentQuery] = useState('');
  const assignmentsRef = useRef<HTMLElement>(null);

  const extraSectionKeys = useMemo(() => {
    const keys: string[] = [];
    for (const s of subjects) keys.push(...Object.keys(s.class_hours ?? {}));
    for (const a of assignments) keys.push(...(a.class_sections ?? []));
    return keys;
  }, [subjects, assignments]);

  const { sections: allSections, reload: reloadSections } = useDersDagitSections(extraSectionKeys);

  const teacherNameById = useMemo(
    () => new Map(teachers.map((t) => [t.user_id, t.display_name?.trim() || t.user_id.slice(0, 8)])),
    [teachers],
  );

  const selectedSubject = useMemo(
    () => subjects.find((s) => s.id === selectedSubjectId) ?? null,
    [subjects, selectedSubjectId],
  );

  const filteredSubjects = useMemo(() => {
    const q = subjectQuery.trim().toLowerCase();
    if (!q) return subjects;
    return subjects.filter((s) => s.name.toLowerCase().includes(q) || (s.short_code ?? '').toLowerCase().includes(q));
  }, [subjects, subjectQuery]);

  const normalizedAssignments = useMemo(
    () =>
      assignments.map((a) => ({
        ...a,
        class_sections: canonicalizeSectionList(a.class_sections ?? []),
      })),
    [assignments],
  );

  const tableRows = useMemo(() => {
    let rows = filterAssignments(normalizedAssignments, selectedSubject, sectionFilter);
    const q = assignmentQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((a) => {
      const sec = a.class_sections.join(' ').toLowerCase();
      const sub = a.subject_name.toLowerCase();
      const teachers = (a.teacher_ids ?? [])
        .map((id) => teacherNameById.get(id)?.toLowerCase() ?? '')
        .join(' ');
      return sub.includes(q) || sec.includes(q) || teachers.includes(q);
    });
  }, [normalizedAssignments, selectedSubject, sectionFilter, assignmentQuery, teacherNameById]);

  const warnings = useMemo(
    () => computeDerslerWarnings(subjects, assignments, validationIssues, teacherNameById),
    [subjects, assignments, validationIssues, teacherNameById],
  );

  const load = useCallback(async () => {
    if (!token || !studio) return;
    setLoading(true);
    try {
      const [sub, asn, tch, rm, gr, sp] = await Promise.all([
        apiFetch<DerslerSubject[]>(`/ders-dagit/studios/${studio.id}/subjects`, { token }),
        apiFetch<DerslerAssignment[]>(`/ders-dagit/studios/${studio.id}/assignments`, { token }),
        apiFetch<Teacher[]>(`/ders-dagit/studios/${studio.id}/teachers`, { token }).catch(() => []),
        apiFetch<Room[]>('/ders-dagit/rooms', { token }).catch(() => []),
        apiFetch<{ groups: Group[] }>(`/ders-dagit/studios/${studio.id}/groups`, { token }).catch(() => ({
          groups: [],
        })),
        apiFetch<{ type: string }>(`/ders-dagit/studios/${studio.id}/school-profile`, { token }).catch(() => ({
          type: 'anadolu_lise',
        })),
      ]);
      setSubjects(
        sub.map((s) => ({
          ...s,
          class_hours: mergeRecordBySectionAlias(s.class_hours ?? {}),
        })),
      );
      setAssignments(asn);
      setTeachers(tch);
      setRooms(rm);
      setGroups(gr.groups ?? []);
      setSchoolType(sp.type);
      setSelectedSubjectId((prev) => prev ?? sub[0]?.id ?? null);
      await reloadSections();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Veri yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [token, studio, reloadSections]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedSubject) {
      setSubjectDraftName('');
      setSubjectDraftCode('');
      setSubjectDraftHours({});
      return;
    }
    setSubjectDraftName(selectedSubject.name);
    setSubjectDraftCode(selectedSubject.short_code ?? '');
    setSubjectDraftHours(mergeRecordBySectionAlias(selectedSubject.class_hours ?? {}));
  }, [selectedSubject?.id]);

  function selectSubject(id: string, opts?: { scrollAssignments?: boolean }) {
    setSelectedSubjectId(id);
    setSectionFilter('');
    setSubjectDetailOpen(true);
    if (opts?.scrollAssignments !== false) {
      requestAnimationFrame(() => {
        assignmentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }

  const subjectDirty =
    !!selectedSubject &&
    (subjectDraftName !== selectedSubject.name ||
      subjectDraftCode !== (selectedSubject.short_code ?? '') ||
      JSON.stringify(subjectDraftHours) !== JSON.stringify(selectedSubject.class_hours ?? {}));

  function openNewAssignment(sub?: DerslerSubject | null) {
    const s = sub ?? selectedSubject;
    const sec =
      (sectionFilter && allSections.includes(sectionFilter) ? sectionFilter : null) ??
      (s ? Object.keys(s.class_hours ?? {})[0] : null) ??
      allSections[0] ??
      '';
    const hrs = sec && s?.class_hours?.[sec] ? s.class_hours[sec]! : 4;
    const teacherId = teachers[0]?.user_id ?? '';
    const draft: LessonAssignmentDraft = {
      subject_id: s?.id ?? '',
      subject_name: s?.name ?? '',
      primary_teacher_id: teacherId,
      co_teacher_ids: [],
      section: sec,
      joined_sections: [],
      use_joined: false,
      group_id: '',
      weekly_hours: hrs,
      day_distribution: inferDayDistribution(hrs),
      biweekly: false,
      room_mode: 'class',
      room_ids: suggestRooms('class', {
        section: sec,
        subjectName: s?.name ?? '',
        teacherId,
        rooms,
      }),
      place_first: false,
    };
    setAssignmentDraft(draft);
    setListActiveId(null);
    setDialogOpen(true);
  }

  function openEditAssignment(a: DerslerAssignment) {
    setAssignmentDraft(assignmentToDraft(a as LessonAssignmentRow, subjects));
    setListActiveId(a.id);
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

  async function addSubject() {
    if (!token || !studio || !newSubjectName.trim()) return;
    const sec = newSection.trim() || allSections[0] || '5A';
    await apiFetch(`/ders-dagit/studios/${studio.id}/subjects`, {
      token,
      method: 'POST',
      body: { name: newSubjectName.trim(), class_hours: { [sec]: newHours } },
    });
    setNewSubjectName('');
    toast.success('Ders eklendi');
    await load();
  }

  async function deleteSubject(id: string) {
    if (!token || !studio) return;
    const r = await apiFetch<{ deleted_assignments?: number }>(
      `/ders-dagit/studios/${studio.id}/subjects/${id}`,
      { token, method: 'DELETE' },
    );
    if (selectedSubjectId === id) setSelectedSubjectId(null);
    const n = r.deleted_assignments ?? 0;
    toast.success(n > 0 ? `Ders silindi (${n} bağlı atama)` : 'Ders silindi');
    await load();
  }

  async function syncCatalogToAssignments(subjectId: string, quiet = false) {
    if (!token || !studio) return;
    setCatalogSyncing(true);
    try {
      const r = await apiFetch<{ created?: number; updated?: number }>(
        `/ders-dagit/studios/${studio.id}/subjects/${subjectId}/sync-assignments`,
        { token, method: 'POST' },
      );
      if (!quiet) {
        const n = (r.created ?? 0) + (r.updated ?? 0);
        toast.success(n > 0 ? `Katalog → atama (${r.created ?? 0} yeni, ${r.updated ?? 0} güncel)` : 'Eşlenecek şube saati yok');
      }
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Eşitleme başarısız');
    } finally {
      setCatalogSyncing(false);
    }
  }

  async function saveSubjectDraft() {
    if (!token || !studio || !selectedSubject || !subjectDraftName.trim()) return;
    setSubjectSaving(true);
    try {
      const updated = {
        ...selectedSubject,
        name: subjectDraftName.trim(),
        short_code: subjectDraftCode.trim() || null,
        class_hours: mergeRecordBySectionAlias(subjectDraftHours),
      };
      await apiFetch(`/ders-dagit/studios/${studio.id}/subjects`, {
        token,
        method: 'POST',
        body: {
          id: selectedSubject.id,
          name: updated.name,
          short_code: updated.short_code,
          class_hours: updated.class_hours,
        },
      });
      setSubjects((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      await syncCatalogToAssignments(selectedSubject.id, true);
      toast.success('Ders ve atamalar güncellendi');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kayıt başarısız');
    } finally {
      setSubjectSaving(false);
    }
  }

  function handleSubjectAction(key: EntityActionKey) {
    if (!selectedSubject && key !== 'new') return;
    switch (key) {
      case 'new':
        if (!newSubjectName.trim()) {
          toast.info('Üstte ders adı yazın');
          return;
        }
        void addSubject();
        break;
      case 'edit':
        setSubjectDetailOpen(true);
        break;
      case 'save':
        void saveSubjectDraft();
        break;
      case 'delete':
        void deleteSubject(selectedSubject!.id);
        break;
      case 'assign':
        openNewAssignment(selectedSubject);
        break;
      case 'timetable':
        setSubjectDetailOpen(true);
        break;
      case 'constraints':
        setSubjectDetailOpen(true);
        break;
    }
  }

  const subjectActions = [
    { key: 'new' as const, label: 'Yeni' },
    { key: 'edit' as const, label: 'Güncelle' },
    { key: 'assign' as const, label: 'Ders atama' },
    { key: 'timetable' as const, label: 'Şube saatleri', hidden: true },
    { key: 'constraints' as const, label: 'Şube saatleri' },
    { key: 'save' as const, label: 'Kaydet', disabled: !selectedSubject || !subjectDirty || subjectSaving },
    { key: 'delete' as const, label: 'Sil' },
  ];

  const assignmentPanelTitle = selectedSubject
    ? `Atanan dersler — ${selectedSubject.name}`
    : 'Atanan dersler';

  const catalogPlanForSection = useMemo(() => {
    if (!sectionFilter) return null;
    let total = 0;
    for (const sub of subjects) {
      for (const [sec, h] of Object.entries(sub.class_hours ?? {})) {
        if (sectionsMatch(sec, sectionFilter)) total += Number(h) || 0;
      }
    }
    return total > 0 ? total : null;
  }, [subjects, sectionFilter]);

  return (
    <div className={cn(DD_PAGE, 'min-h-0')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <DdPageHeader
          icon={BookOpen}
          title="Dersler ve atamalar"
          description="Ders kataloğu (şube saatleri) ile atamalar ayrı kayıtlar; atamalar öğretmen/derslik sayfalarıyla ortaktır."
        />
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center rounded-full border bg-muted/60 px-2.5 py-0.5 text-xs font-medium"
            aria-label="Okul türü"
          >
            {schoolTypeLabel(schoolType)}
          </span>
          <Button type="button" size="sm" variant="outline" onClick={() => void load()} disabled={loading} aria-label="Yenile">
            <RefreshCw className={cn('mr-1 size-3.5', loading && 'animate-spin')} />
            Yenile
          </Button>
          <Button type="button" size="sm" variant="outline" asChild>
            <Link href="/ders-dagit/studyo/atamalar">Gelişmiş atamalar</Link>
          </Button>
        </div>
      </div>

      <DdCatalogAssignmentsHint catalog />

      <SchoolPlanImportPanel onImported={() => void load()} />

      <CatalogImportPanel schoolType={schoolType} onImported={load} />

      {warnings.length > 0 && (
        <div
          className="rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2 dark:border-amber-900/50 dark:bg-amber-950/40"
          role="alert"
          aria-live="polite"
        >
          <div className="mb-1 flex items-center gap-2 text-xs font-medium text-amber-900 dark:text-amber-100">
            <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
            Uyarılar ({warnings.length})
          </div>
          <ul className="max-h-20 space-y-0.5 overflow-y-auto text-[11px] text-amber-900/90 dark:text-amber-100/90">
            {warnings.map((w) => (
              <li key={w.id} className={w.severity === 'error' ? 'font-medium text-destructive' : ''}>
                {w.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="min-w-0 flex-1 space-y-4">
        <DdEntityWorkspace
          title="Tanımlı dersler"
          toolbar={
            <div className="flex flex-wrap items-center gap-2">
              <Input
                className="h-8 w-36 text-xs"
                placeholder="Yeni ders adı"
                value={newSubjectName}
                onChange={(e) => setNewSubjectName(e.target.value)}
              />
              <Button type="button" size="sm" variant="secondary" onClick={() => void addSubject()} disabled={!newSubjectName.trim()}>
                <Plus className="mr-1 size-3.5" />
                Ders ekle
              </Button>
            </div>
          }
          actions={
            <DdEntityActionBar
              kind="ders"
              selectedLabel={selectedSubject?.name ?? null}
              actions={subjectActions}
              onAction={handleSubjectAction}
            />
          }
          selectedTitle={selectedSubject?.name}
          list={
            <SubjectEntityTable
              subjects={subjects}
              activeId={selectedSubjectId}
              query={subjectQuery}
              onQueryChange={setSubjectQuery}
              onSelect={(id) => selectSubject(id)}
              onDoubleClick={(id) => {
                selectSubject(id, { scrollAssignments: false });
                openNewAssignment(subjects.find((s) => s.id === id) ?? null);
              }}
            />
          }
          detailOpen={subjectDetailOpen && !!selectedSubject}
          detail={
            selectedSubject ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Adı</Label>
                    <Input value={subjectDraftName} onChange={(e) => setSubjectDraftName(e.target.value)} />
                  </div>
                  <div>
                    <Label>Kısa ad</Label>
                    <Input value={subjectDraftCode} onChange={(e) => setSubjectDraftCode(e.target.value)} placeholder="MAT" />
                  </div>
                </div>
                <SubjectSectionHoursTable
                  classHours={subjectDraftHours}
                  sections={allSections}
                  onChange={setSubjectDraftHours}
                />
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" disabled={!subjectDirty || subjectSaving} onClick={() => void saveSubjectDraft()}>
                    Dersi kaydet
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={catalogSyncing || subjectSaving}
                    onClick={() => void syncCatalogToAssignments(selectedSubject.id)}
                  >
                    Katalog → atamalar
                  </Button>
                </div>
              </div>
            ) : null
          }
          footer="Ders seçince alttaki atamalara kayar · çift tık = yeni atama"
        />

        <section ref={assignmentsRef} id="dd-ders-atamalar" className="scroll-mt-3">
          <DdCard variant="teal" className="overflow-hidden p-0">
            <AssignedLessonsPanel
              wideTable
              fillHeight
              headerIcon={ListChecks}
              maxHeightClass="max-h-[min(56vh,520px)]"
              className="rounded-none border-0 shadow-none"
              title={assignmentPanelTitle}
              filterSection={sectionFilter || undefined}
              catalogPlanHours={catalogPlanForSection}
              classProfiles={classProfiles}
              capacityRows={normalizedAssignments as LessonAssignmentRow[]}
              rows={tableRows as LessonAssignmentRow[]}
              subjects={subjects}
              activeId={listActiveId}
              teacherNames={teacherNameById}
              onSelect={setListActiveId}
              onNew={() => openNewAssignment()}
              onEdit={() => {
                const a = tableRows.find((x) => x.id === listActiveId);
                if (a) openEditAssignment(a);
              }}
              onDelete={() => listActiveId && void deleteAssignment(listActiveId)}
              toolbar={
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[10rem] flex-1 sm:max-w-xs">
                    <Search
                      className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                      aria-hidden
                    />
                    <Input
                      className="h-8 pl-8 text-xs"
                      placeholder="Ders, şube veya öğretmen…"
                      value={assignmentQuery}
                      onChange={(e) => setAssignmentQuery(e.target.value)}
                    />
                  </div>
                  <DdSelect
                    className="h-8 min-w-[8rem] text-xs"
                    value={sectionFilter}
                    onValueChange={setSectionFilter}
                    placeholder="Tüm şubeler"
                    options={[{ value: '', label: 'Tüm şubeler' }, ...allSections.map((s) => ({ value: s, label: s }))]}
                    id="dd-section-filter"
                  />
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {tableRows.length} kayıt
                    {selectedSubject ? ` · ${selectedSubject.name}` : ''}
                  </span>
                </div>
              }
            />
          </DdCard>
        </section>
      </div>

      {token && studio && (
        <LessonAssignmentDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          studioId={studio.id}
          token={token}
          draft={assignmentDraft}
          onDraftChange={setAssignmentDraft}
          teachers={teachers}
          subjects={subjects}
          rooms={rooms}
          groups={groups}
          sections={allSections}
          onSaved={() => void load()}
        />
      )}
    </div>
  );
}
