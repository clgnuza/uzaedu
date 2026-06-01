'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  DdCard,
  DdPageHeader,
  DD_PAGE,
} from '@/components/ders-dagit/dd-ui';
import { formatClassroomDisplayName } from '@/lib/classroom-display-name';
import { Building2, DoorOpen, Sparkles, Trash2 } from 'lucide-react';
import { DdEntityActionBar, type EntityActionKey } from '@/components/ders-dagit/dd-entity-action-bar';
import { DdEntityWorkspace } from '@/components/ders-dagit/dd-entity-workspace';
import { RoomEntityTable, type RoomRow } from '@/components/ders-dagit/room-entity-table';
import { DdSectionField } from '@/components/ders-dagit/dd-section-picker';
import { DdMultiSelect, DdSelectField } from '@/components/ders-dagit/dd-select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { normalizeClassSectionNamesFromPool } from '@/lib/class-section-canonical';
import { useDersDagitSections } from '@/hooks/use-ders-dagit-sections';
import {
  assignmentToDraft,
  assignmentUsesRoom,
  type LessonAssignmentDraft,
  type LessonAssignmentRow,
} from '@/lib/lesson-assignment';
import { AssignedLessonsPanel } from '@/components/ders-dagit/assigned-lessons-panel';
import { LessonAssignmentDialog } from '@/components/ders-dagit/lesson-assignment-dialog';
import { toast } from 'sonner';
import { DdCatalogAssignmentsHint } from '@/components/ders-dagit/dd-catalog-assignments-hint';
import { useDersDagitClassProfiles } from '@/hooks/use-ders-dagit-class-profiles';
import { planlamaIliskileriUrl, sinifSaatleriUrl } from '@/lib/dd-entity-scope';

type Building = { id: string; name: string };
type Room = RoomRow & {
  allowed_class_sections?: string[] | null;
  allowed_teacher_ids?: string[] | null;
};
type TeacherRow = { user_id: string; display_name?: string | null };
type SubjectRow = { id: string; name: string; short_code?: string | null };
type GroupRow = { id: string; name: string; parallel_mode: string | null; member_sections: string[] };

function roomPrimarySection(room: Room | null): string {
  return room?.allowed_class_sections?.[0]?.trim() ?? '';
}

export default function DersliklerPage() {
  const { token } = useAuth();
  const router = useRouter();
  const { studio, loading: studioLoading } = useDersDagitStudio();
  const { profiles: classProfiles } = useDersDagitClassProfiles(studio?.id);
  const assignmentsRef = useRef<HTMLElement>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [assignments, setAssignments] = useState<LessonAssignmentRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [assignmentDraft, setAssignmentDraft] = useState<LessonAssignmentDraft | null>(null);
  const [listActiveId, setListActiveId] = useState<string | null>(null);
  const [autoBusy, setAutoBusy] = useState(false);
  const [purgeBusy, setPurgeBusy] = useState(false);
  const [rName, setRName] = useState('');
  const [rCap, setRCap] = useState(30);
  const [rSection, setRSection] = useState('');
  const [rBuildingId, setRBuildingId] = useState('');
  const [rAllowedSubjects, setRAllowedSubjects] = useState<string[]>([]);
  const [rAllowedTeachers, setRAllowedTeachers] = useState<string[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const extraSectionKeys = useMemo(
    () => [...assignments.flatMap((a) => a.class_sections ?? []), ...rooms.flatMap((r) => r.allowed_class_sections ?? [])],
    [assignments, rooms],
  );
  const { sections: allSections, reload: reloadSections } = useDersDagitSections(extraSectionKeys);

  const buildingById = useMemo(() => new Map(buildings.map((b) => [b.id, b.name])), [buildings]);
  const active = useMemo(() => rooms.find((r) => r.id === activeId) ?? null, [rooms, activeId]);

  const load = useCallback(async () => {
    if (!token || !studio) return;
    const [b, r, asn, sub, tch, gr, secs] = await Promise.all([
      apiFetch<Building[]>('/ders-dagit/buildings', { token }),
      apiFetch<Room[]>('/ders-dagit/rooms', { token }),
      apiFetch<LessonAssignmentRow[]>(`/ders-dagit/studios/${studio.id}/assignments`, { token }).catch(() => []),
      apiFetch<SubjectRow[]>(`/ders-dagit/studios/${studio.id}/subjects`, { token }).catch(() => []),
      apiFetch<TeacherRow[]>(`/ders-dagit/studios/${studio.id}/teachers`, { token }).catch(() => []),
      apiFetch<{ groups: GroupRow[] }>(`/ders-dagit/studios/${studio.id}/groups`, { token }).catch(() => ({
        groups: [],
      })),
      apiFetch<string[]>(`/ders-dagit/studios/${studio.id}/class-sections`, { token }).catch(() => []),
    ]);
    const pool = [
      ...(Array.isArray(secs) ? secs : []),
      ...asn.flatMap((a) => a.class_sections ?? []),
      ...r.flatMap((x) => x.allowed_class_sections ?? []),
    ];
    setBuildings(b);
    setRooms(r);
    setAssignments(
      asn.map((row) => ({
        ...row,
        class_sections: normalizeClassSectionNamesFromPool(row.class_sections ?? [], pool),
      })),
    );
    setSubjects(sub);
    setTeachers(tch);
    setGroups(gr.groups ?? []);
    void reloadSections();
    setActiveId((prev) => (prev && r.some((x) => x.id === prev) ? prev : r[0]?.id ?? null));
  }, [token, studio, reloadSections]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!detailOpen || !activeId) return;
    const r = rooms.find((x) => x.id === activeId);
    if (r) loadRoomToForm(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- form sync when list refreshes
  }, [rooms, activeId, detailOpen]);

  const teacherNameById = useMemo(
    () => new Map(teachers.map((t) => [t.user_id, t.display_name?.trim() || t.user_id.slice(0, 8)])),
    [teachers],
  );
  const roomNameById = useMemo(() => new Map(rooms.map((r) => [r.id, r.name])), [rooms]);
  const assignmentCountByRoom = useMemo(() => {
    const m = new Map<string, number>();
    for (const room of rooms) {
      let n = 0;
      for (const a of assignments) {
        if (assignmentUsesRoom(a, room)) n += 1;
      }
      if (n) m.set(room.id, n);
    }
    return m;
  }, [assignments, rooms]);
  const roomAssignments = useMemo(() => {
    if (!active) return [];
    return assignments.filter((a) => assignmentUsesRoom(a, active));
  }, [assignments, active]);

  const subjectOptions = useMemo(
    () => subjects.map((s) => ({ value: s.name, label: s.name })),
    [subjects],
  );
  const teacherOptions = useMemo(
    () =>
      teachers.map((t) => ({
        value: t.user_id,
        label: t.display_name?.trim() || t.user_id.slice(0, 8),
      })),
    [teachers],
  );
  const buildingOptions = useMemo(
    () => [
      { value: '', label: 'Bina atanmadı' },
      ...buildings.map((b) => ({ value: b.id, label: b.name })),
    ],
    [buildings],
  );

  function loadRoomToForm(r: Room) {
    setEditId(r.id);
    setRName(r.name);
    setRCap(r.capacity ?? 30);
    setRSection(r.allowed_class_sections?.[0] ?? '');
    setRBuildingId(r.building_id ?? '');
    setRAllowedSubjects(r.allowed_subjects ?? []);
    setRAllowedTeachers(r.allowed_teacher_ids ?? []);
  }

  function selectRoom(id: string) {
    setActiveId(id);
    setListActiveId(null);
  }

  function clearForm() {
    setEditId(null);
    setRName('');
    setRCap(30);
    setRSection('');
    setRBuildingId(buildings[0]?.id ?? '');
    setRAllowedSubjects([]);
    setRAllowedTeachers([]);
  }

  function roomBody() {
    const sections = rSection.trim()
      ? normalizeClassSectionNamesFromPool([rSection.trim()], allSections)
      : [];
    return {
      name: rName.trim(),
      building_id: rBuildingId || null,
      capacity: rCap,
      features: [] as string[],
      allowed_subjects: rAllowedSubjects.length ? rAllowedSubjects : null,
      allowed_class_sections: sections.length ? sections : null,
      allowed_teacher_ids: rAllowedTeachers.length ? rAllowedTeachers : null,
    };
  }

  async function saveRoom() {
    if (!token || !rName.trim()) return;
    if (!rSection.trim()) {
      toast.error('Bağlı şube seçin');
      return;
    }
    if (rBuildingId && !buildings.some((b) => b.id === rBuildingId)) {
      toast.error('Geçersiz bina seçimi');
      return;
    }
    const prevId = editId;
    const res = await apiFetch<Room>('/ders-dagit/rooms', {
      token,
      method: 'POST',
      body: prevId ? { id: prevId, ...roomBody() } : roomBody(),
    });
    toast.success(prevId ? 'Güncellendi' : 'Eklendi');
    setActiveId(res.id);
    setEditId(res.id);
    loadRoomToForm(res);
    setDetailOpen(true);
    await load();
  }

  async function deleteRoom(id: string) {
    if (!token || !window.confirm('Derslik silinsin mi?')) return;
    await apiFetch(`/ders-dagit/rooms/${id}`, { token, method: 'DELETE' });
    toast.success('Silindi');
    if (activeId === id) {
      clearForm();
      setDetailOpen(false);
    }
    await load();
  }

  async function deleteAllRooms() {
    if (!token || !rooms.length) return;
    if (
      !window.confirm(
        `${rooms.length} derslik silinecek. Atamalardaki derslik bağlantıları kaldırılır. Devam?`,
      )
    ) {
      return;
    }
    setPurgeBusy(true);
    try {
      const res = await apiFetch<{ deleted: number }>('/ders-dagit/rooms/all', { token, method: 'DELETE' });
      toast.success(`${res.deleted} derslik silindi`);
      clearForm();
      setActiveId(null);
      setDetailOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silinemedi');
    } finally {
      setPurgeBusy(false);
    }
  }

  async function autoCreateFromSections() {
    if (!token || !studio) return;
    setAutoBusy(true);
    try {
      const res = await apiFetch<{
        created: number;
        skipped: number;
        consolidated?: number;
        sections: string[];
      }>('/ders-dagit/rooms/auto-from-sections', { token, method: 'POST', body: { studio_id: studio.id } });
      if (!res.sections.length) {
        toast.message('Şube bulunamadı — önce sınıf profili veya atama ekleyin');
      } else if (res.created === 0 && !res.consolidated) {
        toast.success(`Tüm şubeler için derslik zaten var (${res.skipped} şube)`);
      } else {
        const parts = [];
        if (res.consolidated) parts.push(`${res.consolidated} çift birleştirildi`);
        if (res.created) parts.push(`${res.created} yeni`);
        if (res.skipped) parts.push(`${res.skipped} zaten vardı`);
        toast.success(parts.join(' · ') || 'Güncellendi');
      }
      await load();
    } finally {
      setAutoBusy(false);
    }
  }

  function openNewAssignment() {
    if (!activeId) return;
    const sec = active?.allowed_class_sections?.[0] ?? allSections[0] ?? '';
    setAssignmentDraft({
      subject_id: subjects[0]?.id ?? '',
      subject_name: subjects[0]?.name ?? '',
      primary_teacher_id: teachers[0]?.user_id ?? '',
      co_teacher_ids: [],
      section: sec,
      joined_sections: [],
      use_joined: false,
      group_id: '',
      weekly_hours: 4,
      day_distribution: [2, 2],
      biweekly: false,
      room_mode: 'class',
      room_ids: [activeId],
      place_first: false,
    });
    setListActiveId(null);
    setDialogOpen(true);
  }

  function openEditAssignment(row: LessonAssignmentRow) {
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

  function handleAction(key: EntityActionKey) {
    switch (key) {
      case 'new':
        setActiveId(null);
        clearForm();
        setDetailOpen(true);
        setListActiveId(null);
        break;
      case 'edit':
        if (active) {
          loadRoomToForm(active);
          setDetailOpen(true);
        }
        break;
      case 'save':
        void saveRoom();
        break;
      case 'delete':
        if (activeId) void deleteRoom(activeId);
        break;
      case 'timetable': {
        const sec = roomPrimarySection(active);
        if (!sec) {
          toast.message('Önce bağlı şubeyi tanımlayın');
          if (active) {
            loadRoomToForm(active);
            setDetailOpen(true);
          }
          break;
        }
        router.push(sinifSaatleriUrl({ section: sec, openTime: true }));
        break;
      }
      case 'assign':
        assignmentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        openNewAssignment();
        break;
      case 'constraints': {
        const sec = roomPrimarySection(active);
        router.push(planlamaIliskileriUrl(sec ? { section: sec } : {}));
        break;
      }
    }
  }

  const roomActions = [
    { key: 'new' as const, label: 'Yeni' },
    { key: 'edit' as const, label: 'Güncelle' },
    { key: 'timetable' as const, label: 'Zaman tablosu' },
    { key: 'assign' as const, label: 'Ders atama' },
    { key: 'constraints' as const, label: 'Kısıtlamalar' },
    { key: 'save' as const, label: 'Kaydet', disabled: !rName.trim() },
    { key: 'delete' as const, label: 'Sil', variant: 'outline' as const },
  ];

  if (studioLoading) {
    return (
      <div className={DD_PAGE}>
        <p className="text-sm text-muted-foreground">Stüdyo yükleniyor…</p>
      </div>
    );
  }

  return (
    <div className={DD_PAGE}>
      <DdPageHeader
        icon={Building2}
        title="Derslikler"
        description="Derslik tanımı okul genelinde; ders atamaları diğer sayfalarla ortaktır."
      />

      <DdCatalogAssignmentsHint />

      <DdEntityWorkspace
        title="Tanımlı derslikler"
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" asChild>
              <Link href="/ders-dagit/studyo/binalar">Binalar</Link>
            </Button>
            <Button
              type="button"
              size="sm"
              className="gap-1"
              disabled={autoBusy || !studio}
              onClick={() => void autoCreateFromSections()}
            >
              <Sparkles className="size-3.5" aria-hidden />
              {autoBusy ? 'Oluşturuluyor…' : 'Sınıflara göre otomatik'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="gap-1"
              disabled={purgeBusy || !rooms.length}
              onClick={() => void deleteAllRooms()}
            >
              <Trash2 className="size-3.5" aria-hidden />
              {purgeBusy ? 'Siliniyor…' : 'Tümünü sil'}
            </Button>
          </div>
        }
        actions={
          <DdEntityActionBar
            kind="derslik"
            selectedLabel={active?.name ?? (editId ? rName : null)}
            actions={roomActions}
            onAction={handleAction}
          />
        }
        selectedTitle={active?.name ?? (rName.trim() || undefined)}
        list={
          <RoomEntityTable
            rooms={rooms}
            buildingName={(id) => (id ? buildingById.get(id) ?? '—' : '—')}
            activeId={activeId}
            query={query}
            onQueryChange={setQuery}
            onSelect={selectRoom}
            assignmentCount={(id) => assignmentCountByRoom.get(id) ?? 0}
          />
        }
        detailOpen={detailOpen}
        detail={
          <div className="grid gap-3 sm:grid-cols-2">
            <DdSectionField
              className="sm:col-span-2"
              label="Bağlı şube"
              value={rSection}
              extraSections={allSections}
              onValueChange={(sec) => {
                setRSection(sec);
                if (!rName.trim() || rName.includes(' · derslik')) {
                  setRName(formatClassroomDisplayName(sec));
                }
              }}
            />
            <DdSelectField
              className="sm:col-span-2"
              label="Bina"
              value={rBuildingId}
              onValueChange={setRBuildingId}
              options={buildingOptions}
              placeholder={buildings.length ? 'Bina seçin' : 'Önce üstten bina ekleyin'}
              disabled={!buildings.length}
            />
            <div className="sm:col-span-2">
              <Label>Görünen ad</Label>
              <Input
                value={rName}
                onChange={(e) => setRName(e.target.value)}
                placeholder={formatClassroomDisplayName(rSection || '9-A')}
              />
            </div>
            <div>
              <Label>Kapasite</Label>
              <Input type="number" min={1} value={rCap} onChange={(e) => setRCap(Number(e.target.value))} />
            </div>
            <p className="sm:col-span-2 text-[11px] text-muted-foreground">
              Sınıf derslikleri için şube yeterlidir. Laboratuvar / öğretmen odası için aşağıdaki isteğe bağlı
              kısıtları kullanın.
            </p>
            <details className="sm:col-span-2 rounded-md border bg-muted/20 px-3 py-2">
              <summary className="cursor-pointer text-xs font-medium">Özel derslik kısıtları (isteğe bağlı)</summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">İzinli dersler</Label>
                  <DdMultiSelect
                    value={rAllowedSubjects}
                    onValueChange={setRAllowedSubjects}
                    options={subjectOptions}
                    rows={4}
                    placeholder="Tüm dersler"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">İzinli öğretmenler</Label>
                  <DdMultiSelect
                    value={rAllowedTeachers}
                    onValueChange={setRAllowedTeachers}
                    options={teacherOptions}
                    rows={4}
                    placeholder="Tüm öğretmenler"
                  />
                </div>
              </div>
            </details>
          </div>
        }
        footer={`${buildings.length} bina · ${rooms.length} derslik`}
      />

      {active && studio && token && (
        <section ref={assignmentsRef} id="dd-derslik-atamalar" className="scroll-mt-3">
        <DdCard variant="sky" className="overflow-hidden p-0">
          <AssignedLessonsPanel
            wideTable
            fillHeight
            headerIcon={DoorOpen}
            maxHeightClass="max-h-[min(56vh,520px)]"
            className="rounded-none border-0 shadow-none"
            title="Bu derslikteki atanan dersler"
            teacherName={active.name}
            rows={roomAssignments}
            filterSection={roomPrimarySection(active) || undefined}
            classProfiles={classProfiles}
            capacityRows={assignments}
            subjects={subjects}
            activeId={listActiveId}
            teacherNames={teacherNameById}
            roomNames={roomNameById}
            onSelect={setListActiveId}
            onNew={() => openNewAssignment()}
            onEdit={() => {
              const r = roomAssignments.find((x) => x.id === listActiveId);
              if (r) openEditAssignment(r);
            }}
            onDelete={() => listActiveId && void deleteAssignment(listActiveId)}
            toolbar={
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {roomAssignments.length} atama
                  {roomAssignments.length
                    ? ` · ${roomAssignments.reduce((s, r) => s + r.weekly_hours, 0)} haftalık ders saati`
                    : ''}
                </span>
                <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" asChild>
                  <Link href={`/ders-dagit/studyo/atamalar?room=${encodeURIComponent(active.id)}`}>
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
          teachers={teachers.map((t) => ({
            ...t,
            display_name: t.display_name ?? undefined,
          }))}
          subjects={subjects}
          rooms={rooms}
          groups={groups}
          sections={allSections}
          lockRoomId={active.id}
          onSaved={() => void load()}
        />
      )}
    </div>
  );
}
