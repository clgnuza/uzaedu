'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import { useStudioValidation } from '@/hooks/use-studio-validation';
import { apiFetch } from '@/lib/api';
import {
  assignmentToDraft,
  suggestRooms,
  type LessonAssignmentDraft,
  type LessonAssignmentRow,
} from '@/lib/lesson-assignment';
import { AssignedLessonsPanel } from '@/components/ders-dagit/assigned-lessons-panel';
import { LessonAssignmentDialog } from '@/components/ders-dagit/lesson-assignment-dialog';
import {
  computeDerslerWarnings,
  downloadTtkbCsv,
  filterAssignments,
  schoolTypeLabel,
  subjectTotalHours,
  type DerslerAssignment,
  type DerslerSubject,
  type TtkbPreview,
} from '@/lib/dersler-studio';
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
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { AlertTriangle, BookOpen, Download, Plus, RefreshCw } from 'lucide-react';

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
  const { studio } = useDersDagitStudio();
  const { issues: validationIssues, refresh: refreshValidation } = useStudioValidation(studio?.id);

  const [subjects, setSubjects] = useState<DerslerSubject[]>([]);
  const [assignments, setAssignments] = useState<DerslerAssignment[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [schoolType, setSchoolType] = useState('anadolu_lise');
  const [loading, setLoading] = useState(true);

  const [subjectQuery, setSubjectQuery] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [sectionFilter, setSectionFilter] = useState('');

  const [ttkbPreview, setTtkbPreview] = useState<TtkbPreview | null>(null);
  const [ttkbReplace, setTtkbReplace] = useState(false);
  const [ttkbSyncAssign, setTtkbSyncAssign] = useState(false);
  const [ttkbBusy, setTtkbBusy] = useState(false);

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
  const [studioSections, setStudioSections] = useState<string[]>([]);

  const teacherNameById = useMemo(
    () => new Map(teachers.map((t) => [t.user_id, t.display_name?.trim() || t.user_id.slice(0, 8)])),
    [teachers],
  );

  const selectedSubject = useMemo(
    () => subjects.find((s) => s.id === selectedSubjectId) ?? null,
    [subjects, selectedSubjectId],
  );

  const allSections = useMemo(() => studioSections, [studioSections]);

  const filteredSubjects = useMemo(() => {
    const q = subjectQuery.trim().toLowerCase();
    if (!q) return subjects;
    return subjects.filter((s) => s.name.toLowerCase().includes(q) || (s.short_code ?? '').toLowerCase().includes(q));
  }, [subjects, subjectQuery]);

  const tableRows = useMemo(
    () => filterAssignments(assignments, selectedSubject, sectionFilter),
    [assignments, selectedSubject, sectionFilter],
  );

  const warnings = useMemo(
    () => computeDerslerWarnings(subjects, assignments, validationIssues, teacherNameById),
    [subjects, assignments, validationIssues, teacherNameById],
  );

  const catalogSubjects = useMemo(
    () => subjects.filter((s) => !s.is_elective).sort((a, b) => a.name.localeCompare(b.name, 'tr')),
    [subjects],
  );

  const load = useCallback(async () => {
    if (!token || !studio) return;
    setLoading(true);
    try {
      const [sub, asn, tch, rm, gr, sp, secs] = await Promise.all([
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
        apiFetch<string[]>(`/ders-dagit/studios/${studio.id}/class-sections`, { token }).catch(() => []),
      ]);
      setSubjects(sub);
      setAssignments(asn);
      setStudioSections(Array.isArray(secs) ? secs : []);
      setTeachers(tch);
      setRooms(rm);
      setGroups(gr.groups ?? []);
      setSchoolType(sp.type);
      setSelectedSubjectId((prev) => prev ?? sub[0]?.id ?? null);
      await refreshValidation();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Veri yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [token, studio, refreshValidation]);

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
    setSubjectDraftHours({ ...(selectedSubject.class_hours ?? {}) });
  }, [selectedSubject?.id]);

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
      period_format: 'single',
      room_mode: 'class',
      room_ids: suggestRooms('class', {
        section: sec,
        subjectName: s?.name ?? '',
        teacherId,
        rooms,
      }),
      place_first: false,
      min_days_per_week: 2,
      max_per_day: 2,
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

  async function saveSubjectDraft() {
    if (!token || !studio || !selectedSubject || !subjectDraftName.trim()) return;
    setSubjectSaving(true);
    try {
      const updated = {
        ...selectedSubject,
        name: subjectDraftName.trim(),
        short_code: subjectDraftCode.trim() || null,
        class_hours: { ...subjectDraftHours },
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
      toast.success('Ders güncellendi');
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

  async function previewTtkb(download = false, silent = false) {
    if (!token || !studio) return;
    setTtkbBusy(true);
    try {
      const data = await apiFetch<TtkbPreview>(`/ders-dagit/studios/${studio.id}/seed/ttkb/preview`, { token });
      setTtkbPreview(data);
      if (!data.cell_count) {
        if (!silent) toast.error(data.empty_message ?? 'Liste boş. Kurulumda okul türünü kaydedin.');
        return;
      }
      if (!silent) {
        toast.success(
          `${data.subject_count} ders · ${data.cell_count} satır (${schoolTypeLabel(data.school_type)})`,
        );
      }
      if (download) downloadTtkbCsv(data, schoolTypeLabel(data.school_type));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'TTKB listesi alınamadı');
    } finally {
      setTtkbBusy(false);
    }
  }

  async function seedTtkb() {
    if (!token || !studio) return;
    setTtkbBusy(true);
    try {
      const r = await apiFetch<{
        created: number;
        updated: number;
        assignments_created?: number;
        names?: string[];
      }>(`/ders-dagit/studios/${studio.id}/seed/ttkb`, {
        token,
        method: 'POST',
        body: { replace: ttkbReplace, sync_assignments: ttkbSyncAssign },
      });
      await load();
      if (!ttkbPreview) await previewTtkb(false, true);
      toast.success(
        `Ders kataloğuna ${r.names?.length ?? r.created + r.updated} ders kaydedildi` +
          (ttkbSyncAssign ? ` · ${r.assignments_created ?? 0} atama` : ''),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'TTKB yüklemesi başarısız');
    } finally {
      setTtkbBusy(false);
    }
  }

  const assignmentPanelTitle = selectedSubject
    ? `Atanan dersler — ${selectedSubject.name}`
    : 'Atanan dersler';

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

      <SchoolPlanImportPanel onImported={() => void load()} />

      <DdCard variant="sky" className="overflow-hidden">
        <CardHeader className={DD_CARD_HEADER}>
          <CardTitle className="flex items-center gap-2 text-base">
            <Download className="size-4" aria-hidden />
            TTKB / Maarif listesi
          </CardTitle>
        </CardHeader>
        <CardContent className={cn(DD_CARD_CONTENT, 'space-y-3')}>
          <p className="text-xs text-muted-foreground">
            Kurum türüne göre TTKB ders listesi indirilir (
            <a
              href="https://ttkb.meb.gov.tr/www/haftalik-ders-cizelgeleri/kategori/7"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline"
            >
              ttkb.meb.gov.tr
            </a>
            ). Aşağıdaki ders kataloğu listesine kaydedilir; şube saatlerini ders kartından siz verirsiniz.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" disabled={ttkbBusy} onClick={() => void previewTtkb(true)}>
              <Download className="mr-1 size-3.5" aria-hidden />
              TTKB listesini indir (CSV)
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={ttkbBusy} onClick={() => void previewTtkb(false)}>
              Önizle
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={ttkbBusy || !ttkbPreview?.cells?.length}
              onClick={() => ttkbPreview && downloadTtkbCsv(ttkbPreview, schoolTypeLabel(ttkbPreview.school_type))}
            >
              CSV tekrar indir
            </Button>
            <Button type="button" size="sm" disabled={ttkbBusy || !ttkbPreview} onClick={() => void seedTtkb()}>
              Ders kataloğuna kaydet
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={!token || !studio}
              onClick={async () => {
                if (!token || !studio) return;
                const r = await apiFetch<{ created: number; updated?: number }>(
                  `/ders-dagit/studios/${studio.id}/assignments/sync-from-subjects`,
                  { token, method: 'POST', body: {} },
                );
                toast.success(
                  `${r.created} yeni${r.updated ? `, ${r.updated} güncellendi` : ''} — tekrar tıklamak çoğaltmaz`,
                );
                await load();
              }}
            >
              Katalogdan atama üret
            </Button>
          </div>
          <div className="flex flex-wrap gap-4 text-xs">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={ttkbReplace} onChange={(e) => setTtkbReplace(e.target.checked)} />
              Mevcut dersleri sil (değiştir)
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={ttkbSyncAssign} onChange={(e) => setTtkbSyncAssign(e.target.checked)} />
              Atamaları da oluştur
            </label>
          </div>
          {ttkbPreview && (
            <div className="rounded-lg border bg-muted/30 p-2 text-xs" role="status">
              <p>
                TTKB önizleme: <strong>{ttkbPreview.subject_count}</strong> ders ·{' '}
                <strong>{ttkbPreview.cell_count}</strong> satır
                {ttkbPreview.grades?.length ? ` · sınıflar: ${ttkbPreview.grades.join(', ')}` : ''}
                {ttkbPreview.yillik_plan_keys != null ? ` · yıllık plan: ${ttkbPreview.yillik_plan_keys}` : ''}
              </p>
              <ul className="mt-2 max-h-24 overflow-y-auto">
                {(ttkbPreview.cells?.length ? ttkbPreview.cells : ttkbPreview.sample)
                  .slice(0, 12)
                  .map((c, i) => (
                    <li key={i}>
                      {c.grade}. sınıf — {c.subject_name} ({c.weekly_hours} saat, {c.source})
                    </li>
                  ))}
              </ul>
            </div>
          )}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-2 text-xs">
            <p className="font-medium text-foreground">
              Kayıtlı ders kataloğu ({catalogSubjects.length})
            </p>
            {catalogSubjects.length === 0 ? (
              <p className="mt-1 text-muted-foreground">
                Henüz kayıt yok. Önce önizleyin, sonra &quot;Ders kataloğuna kaydet&quot; kullanın.
              </p>
            ) : (
              <ul className="mt-2 flex max-h-32 flex-wrap gap-1 overflow-y-auto">
                {catalogSubjects.map((s) => (
                  <li
                    key={s.id}
                    className="rounded-md border bg-background px-2 py-0.5 text-[11px]"
                  >
                    {s.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </DdCard>

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
              onSelect={(id) => {
                setSelectedSubjectId(id);
                setSectionFilter('');
                setSubjectDetailOpen(true);
              }}
              onDoubleClick={(id) => {
                setSelectedSubjectId(id);
                setSubjectDetailOpen(true);
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
                <Button type="button" size="sm" disabled={!subjectDirty || subjectSaving} onClick={() => void saveSubjectDraft()}>
                  Dersi kaydet
                </Button>
              </div>
            ) : null
          }
          footer="Satır seç · çift tık = ders atama · şube saatleri tabloda düzenlenir"
        />

        <div className="grid min-h-[min(50vh,520px)] gap-3 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
          <AssignedLessonsPanel
            title={assignmentPanelTitle}
            rows={tableRows as LessonAssignmentRow[]}
            subjects={subjects}
            activeId={listActiveId}
            onSelect={setListActiveId}
            onNew={() => openNewAssignment()}
            onEdit={() => {
              const a = tableRows.find((x) => x.id === listActiveId);
              if (a) openEditAssignment(a);
            }}
            onDelete={() => listActiveId && void deleteAssignment(listActiveId)}
          />
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="dd-section-filter" className="sr-only">
                Şube filtresi
              </Label>
              <DdSelect
                className="h-8 min-w-[140px] text-xs"
                value={sectionFilter}
                onValueChange={setSectionFilter}
                placeholder="Tüm şubeler"
                options={[{ value: '', label: 'Tüm şubeler' }, ...allSections.map((s) => ({ value: s, label: s }))]}
                id="dd-section-filter"
              />
              <p className="text-xs text-muted-foreground">
                Ders atama: öğretmen → ders → sınıf → saat → derslik (Program Stüdyosu adımları)
              </p>
            </div>
          </div>
        </div>
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
