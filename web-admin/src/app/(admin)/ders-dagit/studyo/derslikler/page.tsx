'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
} from '@/components/ders-dagit/dd-ui';
import { Building2, DoorOpen, Sparkles } from 'lucide-react';
import { DdEntityActionBar, type EntityActionKey } from '@/components/ders-dagit/dd-entity-action-bar';
import { DdEntityWorkspace } from '@/components/ders-dagit/dd-entity-workspace';
import { RoomEntityTable, type RoomRow } from '@/components/ders-dagit/room-entity-table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { sortClassSections } from '@/lib/class-section-sort';
import {
  assignmentToDraft,
  type LessonAssignmentDraft,
  type LessonAssignmentRow,
} from '@/lib/lesson-assignment';
import { AssignedLessonsPanel } from '@/components/ders-dagit/assigned-lessons-panel';
import { LessonAssignmentDialog } from '@/components/ders-dagit/lesson-assignment-dialog';
import { toast } from 'sonner';

type Building = { id: string; name: string };
type Room = RoomRow & {
  allowed_class_sections?: string[] | null;
  allowed_teacher_ids?: string[] | null;
};
type TeacherRow = { user_id: string; display_name?: string | null };
type SubjectRow = { id: string; name: string; short_code?: string | null };
type GroupRow = { id: string; name: string; parallel_mode: string | null; member_sections: string[] };

export default function DersliklerPage() {
  const { token } = useAuth();
  const { studio, loading: studioLoading } = useDersDagitStudio();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [assignments, setAssignments] = useState<LessonAssignmentRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [assignPanelOpen, setAssignPanelOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [assignmentDraft, setAssignmentDraft] = useState<LessonAssignmentDraft | null>(null);
  const [listActiveId, setListActiveId] = useState<string | null>(null);
  const [autoBusy, setAutoBusy] = useState(false);
  const [bName, setBName] = useState('Ana Bina');
  const [rName, setRName] = useState('');
  const [rCap, setRCap] = useState(30);
  const [rSubjects, setRSubjects] = useState('');
  const [rSections, setRSections] = useState('');
  const [rTeachers, setRTeachers] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [studioSections, setStudioSections] = useState<string[]>([]);

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
    setBuildings(b);
    setRooms(r);
    setAssignments(asn);
    setSubjects(sub);
    setTeachers(tch);
    setGroups(gr.groups ?? []);
    setStudioSections(Array.isArray(secs) ? secs : []);
    setActiveId((prev) => (prev && r.some((x) => x.id === prev) ? prev : r[0]?.id ?? null));
  }, [token, studio]);

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
    for (const a of assignments) {
      for (const rid of a.room_ids ?? []) {
        m.set(rid, (m.get(rid) ?? 0) + 1);
      }
    }
    return m;
  }, [assignments]);
  const allSections = useMemo(() => studioSections, [studioSections]);
  const roomAssignments = useMemo(() => {
    if (!activeId) return [];
    return assignments.filter((a) => a.room_ids?.includes(activeId));
  }, [assignments, activeId]);

  function loadRoomToForm(r: Room) {
    setEditId(r.id);
    setRName(r.name);
    setRCap(r.capacity ?? 30);
    setRSubjects(r.allowed_subjects?.join(',') ?? '');
    setRSections(r.allowed_class_sections?.join(',') ?? '');
    setRTeachers(r.allowed_teacher_ids?.join(',') ?? '');
    setDetailOpen(true);
  }

  function selectRoom(id: string) {
    const r = rooms.find((x) => x.id === id);
    if (r) loadRoomToForm(r);
    setActiveId(id);
  }

  function clearForm() {
    setEditId(null);
    setRName('');
    setRCap(30);
    setRSubjects('');
    setRSections('');
    setRTeachers('');
  }

  function roomBody() {
    return {
      name: rName.trim(),
      building_id: buildings[0]?.id ?? null,
      capacity: rCap,
      features: [] as string[],
      allowed_subjects: rSubjects ? rSubjects.split(',').map((s) => s.trim()).filter(Boolean) : null,
      allowed_class_sections: rSections
        ? sortClassSections(rSections.split(',').map((s) => s.trim()).filter(Boolean))
        : null,
      allowed_teacher_ids: rTeachers ? rTeachers.split(',').map((s) => s.trim()).filter(Boolean) : null,
    };
  }

  async function saveRoom() {
    if (!token || !rName.trim()) return;
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
    if (activeId === id) clearForm();
    await load();
  }

  async function addBuilding() {
    if (!token || !bName.trim()) return;
    await apiFetch('/ders-dagit/buildings', { token, method: 'POST', body: { name: bName.trim() } });
    toast.success('Bina eklendi');
    await load();
  }

  async function autoCreateFromSections() {
    if (!token || !studio) return;
    setAutoBusy(true);
    try {
      const res = await apiFetch<{ created: number; skipped: number; sections: string[] }>(
        '/ders-dagit/rooms/auto-from-sections',
        { token, method: 'POST', body: { studio_id: studio.id } },
      );
      if (!res.sections.length) {
        toast.message('Şube bulunamadı — önce sınıf profili veya atama ekleyin');
      } else if (res.created === 0) {
        toast.success(`Tüm şubeler için derslik zaten var (${res.skipped} şube)`);
      } else {
        toast.success(`${res.created} derslik oluşturuldu · ${res.skipped} zaten vardı`);
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
      period_format: 'single',
      room_mode: 'class',
      room_ids: [activeId],
      place_first: false,
      min_days_per_week: 2,
      max_per_day: 2,
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
      case 'timetable':
        toast.info(`${active?.name ?? 'Derslik'} için zaman tablosu yakında`);
        break;
      case 'assign':
        setAssignPanelOpen(true);
        openNewAssignment();
        break;
      case 'constraints':
        window.location.href = '/ders-dagit/studyo/planlama-iliskileri';
        break;
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

      <DdEntityWorkspace
        title="Tanımlı derslikler"
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <Input className="h-8 w-32 text-xs" value={bName} onChange={(e) => setBName(e.target.value)} placeholder="Bina" />
            <Button type="button" size="sm" variant="outline" onClick={() => void addBuilding()}>
              Bina +
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
            <div className="sm:col-span-2">
              <Label>Ad</Label>
              <Input value={rName} onChange={(e) => setRName(e.target.value)} placeholder="RESİM ATÖLYESİ" />
            </div>
            <div>
              <Label>Kapasite</Label>
              <Input type="number" value={rCap} onChange={(e) => setRCap(Number(e.target.value))} />
            </div>
            <div>
              <Label>İzinli dersler (virgül)</Label>
              <Input value={rSubjects} onChange={(e) => setRSubjects(e.target.value)} />
            </div>
            <div>
              <Label>İzinli şubeler</Label>
              <Input value={rSections} onChange={(e) => setRSections(e.target.value)} placeholder="9/A, 10-B" />
            </div>
            <div className="sm:col-span-2">
              <Label>İzinli öğretmen id</Label>
              <Input value={rTeachers} onChange={(e) => setRTeachers(e.target.value)} />
            </div>
          </div>
        }
        footer={`${buildings.length} bina · ${rooms.length} derslik`}
      />

      {active && studio && token && (assignPanelOpen || roomAssignments.length > 0) && (
        <DdCard variant="sky" className="overflow-hidden">
          <CardContent className="p-0">
            <div className="grid min-h-[360px] gap-0 lg:grid-cols-[minmax(280px,1fr)_minmax(0,1.2fr)]">
              <AssignedLessonsPanel
                title="Bu derslikteki atanan dersler"
                teacherName={active.name}
                headerIcon={DoorOpen}
                rows={roomAssignments}
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
              />
              <div className="hidden border-l bg-gradient-to-b from-orange-500/5 to-transparent p-6 lg:flex lg:flex-col lg:justify-center">
                <p className="text-sm font-medium text-foreground">Ders atama</p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Yeni ders ile öğretmen, ders ve şube seçilir; derslik bu kayıt için sabittir.
                </p>
                <Button type="button" size="sm" className="mt-4 w-fit gap-1" onClick={() => openNewAssignment()}>
                  Yeni ders ekle
                </Button>
                <Button type="button" size="sm" variant="ghost" className="mt-2 w-fit text-xs" asChild>
                  <Link href={`/ders-dagit/studyo/atamalar?room=${encodeURIComponent(active.id)}`}>
                    Tüm atamalar
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </DdCard>
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
