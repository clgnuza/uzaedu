'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { DdCard, CardContent, CardHeader, CardTitle, DD_PAGE, DD_GRID, DD_CARD_HEADER, DD_CARD_CONTENT, ddVariantAt } from '@/components/ders-dagit/dd-ui';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DdSelect, DdSelectField, DdMultiSelect } from '@/components/ders-dagit/dd-select';
import { DdSectionMultiField } from '@/components/ders-dagit/dd-section-picker';
import { formatClassSectionsList, sortClassSections } from '@/lib/class-section-sort';
import { dayLabel, groupModeLabel } from '@/lib/ders-dagit-labels';
import { toast } from 'sonner';
import { AssignedLessonsPanel } from '@/components/ders-dagit/assigned-lessons-panel';
import { LessonAssignmentDialog } from '@/components/ders-dagit/lesson-assignment-dialog';
import {
  assignmentToDraft,
  type LessonAssignmentDraft,
  type LessonAssignmentRow,
} from '@/lib/lesson-assignment';
import { DdPageHeader } from '@/components/ders-dagit/dd-ui';
import { ListChecks } from 'lucide-react';

const EOKUL_FORMAT_OPTS = [
  { value: 'auto', label: 'Otomatik (tablo → ızgara)' },
  { value: 'xlsx', label: 'Tablo XLSX' },
  { value: 'grid_xlsx', label: 'Program ızgarası XLS' },
  { value: 'csv', label: 'CSV' },
];

const FIX_DAY_OPTS = [1, 2, 3, 4, 5, 6].map((d) => ({ value: String(d), label: dayLabel(d) }));
import Link from 'next/link';

type Assignment = LessonAssignmentRow;

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
  abbreviation: string;
  parallel_mode: string | null;
  member_sections: string[];
};
type GroupsRes = { groups: Group[] };
type Teacher = { user_id: string; display_name?: string };

export default function AtamalarPage() {
  const { token } = useAuth();
  const { studio } = useDersDagitStudio();
  const searchParams = useSearchParams();
  const scopeTeacher = searchParams.get('teacher');
  const scopeSection = searchParams.get('section');
  const scopeRoom = searchParams.get('room');
  const scopeSubject = searchParams.get('subject');
  const [rows, setRows] = useState<Assignment[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [subject, setSubject] = useState('');
  const [sections, setSections] = useState<string[]>(['5A']);
  const [hours, setHours] = useState(4);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomId, setRoomId] = useState('');
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [teacherIds, setTeacherIds] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<Array<{ id: string; name: string }>>([]);
  const [groupId, setGroupId] = useState('');
  const [biweekly, setBiweekly] = useState(false);
  const [placeFirst, setPlaceFirst] = useState(false);
  const [minDays, setMinDays] = useState(2);
  const [maxPerDay, setMaxPerDay] = useState(2);
  const [maxDaysWeek, setMaxDaysWeek] = useState<number | ''>('');
  const [fixDay, setFixDay] = useState(1);
  const [fixLesson, setFixLesson] = useState(1);
  const [fixedSlots, setFixedSlots] = useState<
    Array<{ day_of_week: number; lesson_num: number; class_section?: string }>
  >([]);
  const [csvText, setCsvText] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState('');
  const [coTeach, setCoTeach] = useState(false);
  const [blockLessons, setBlockLessons] = useState(0);
  const [placeOnDays, setPlaceOnDays] = useState('1,2');
  const [schoolType, setSchoolType] = useState('anadolu_lise');
  const [eokulPreview, setEokulPreview] = useState<{
    rows: Array<{
      subject_name: string;
      class_sections: string[];
      weekly_hours: number;
      match_warning: string | null;
    }>;
    warnings: Array<{ message: string }>;
    format: string;
  } | null>(null);
  const [eokulFormat, setEokulFormat] = useState<'auto' | 'xlsx' | 'grid_xlsx' | 'csv'>('auto');
  const [eokulB64, setEokulB64] = useState<string | null>(null);
  const [autoElectiveGroups, setAutoElectiveGroups] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [listActiveId, setListActiveId] = useState<string | null>(null);
  const [assignmentDraft, setAssignmentDraft] = useState<LessonAssignmentDraft | null>(null);

  const load = useCallback(async () => {
    if (!token || !studio) return;
    const [a, g, r, t, sub, sp] = await Promise.all([
      apiFetch<Assignment[]>(`/ders-dagit/studios/${studio.id}/assignments`, { token }),
      apiFetch<GroupsRes>(`/ders-dagit/studios/${studio.id}/groups`, { token }),
      apiFetch<Room[]>('/ders-dagit/rooms', { token }),
      apiFetch<Teacher[]>(`/ders-dagit/studios/${studio.id}/teachers`, { token }),
      apiFetch<Array<{ id: string; name: string }>>(`/ders-dagit/studios/${studio.id}/subjects`, { token }).catch(
        () => [],
      ),
      apiFetch<{ type: string }>(`/ders-dagit/studios/${studio.id}/school-profile`, { token }).catch(() => ({
        type: 'anadolu_lise',
      })),
    ]);
    setSchoolType(sp.type);
    setRows(a);
    setGroups(g.groups);
    setGroupId((prev) => prev || g.groups[0]?.id || '');
    setRooms(r);
    setTeachers(t);
    setSubjects(sub);
    setRoomId((prev) => prev || r[0]?.id || '');
    setTeacherIds((prev) => (prev.length ? prev : t[0]?.user_id ? [t[0].user_id] : []));
  }, [token, studio]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (scopeTeacher) setTeacherIds([scopeTeacher]);
    if (scopeSection) setSections([scopeSection]);
    if (scopeRoom) setRoomId(scopeRoom);
    if (scopeSubject) setSubjectId(scopeSubject);
  }, [scopeTeacher, scopeSection, scopeRoom, scopeSubject]);

  const scopedRows = useMemo(() => {
    let list = rows;
    if (scopeTeacher) list = list.filter((a) => a.teacher_ids?.includes(scopeTeacher));
    if (scopeSection) list = list.filter((a) => a.class_sections.includes(scopeSection));
    if (scopeRoom) list = list.filter((a) => a.room_ids?.includes(scopeRoom));
    if (scopeSubject) {
      list = list.filter(
        (a) =>
          a.subject_id === scopeSubject ||
          subjects.find((s) => s.id === scopeSubject)?.name === a.subject_name,
      );
    }
    return list;
  }, [rows, scopeTeacher, scopeSection, scopeRoom, scopeSubject, subjects]);

  const scopeBanner = useMemo(() => {
    const parts: string[] = [];
    if (scopeTeacher) {
      const t = teachers.find((x) => x.user_id === scopeTeacher);
      parts.push(`öğretmen: ${t?.display_name ?? scopeTeacher}`);
    }
    if (scopeSection) parts.push(`şube: ${scopeSection}`);
    if (scopeRoom) parts.push(`derslik: ${rooms.find((r) => r.id === scopeRoom)?.name ?? scopeRoom}`);
    if (scopeSubject) parts.push(`ders: ${subjects.find((s) => s.id === scopeSubject)?.name ?? scopeSubject}`);
    return parts.length ? parts.join(' · ') : null;
  }, [scopeTeacher, scopeSection, scopeRoom, scopeSubject, teachers, rooms, subjects]);

  const selectedGroup = groups.find((g) => g.id === groupId);

  const allSections = useMemo(
    () => sortClassSections([...new Set(rows.flatMap((r) => r.class_sections))]),
    [rows],
  );

  const panelTitle = scopeTeacher
    ? `Atanan dersler — ${teachers.find((t) => t.user_id === scopeTeacher)?.display_name ?? ''}`
    : 'Atanan dersler';

  function openNewLesson() {
    const d: LessonAssignmentDraft = {
      subject_id: scopeSubject ?? subjects[0]?.id ?? '',
      subject_name: subjects.find((s) => s.id === scopeSubject)?.name ?? '',
      primary_teacher_id: scopeTeacher ?? teachers[0]?.user_id ?? '',
      co_teacher_ids: [],
      section: scopeSection ?? allSections[0] ?? '',
      joined_sections: [],
      use_joined: false,
      group_id: '',
      weekly_hours: 4,
      period_format: 'single',
      room_mode: 'class',
      room_ids: scopeRoom ? [scopeRoom] : [],
      place_first: false,
      min_days_per_week: 2,
      max_per_day: 2,
    };
    setAssignmentDraft(d);
    setListActiveId(null);
    setDialogOpen(true);
  }

  function openEditLesson() {
    const r = scopedRows.find((x) => x.id === listActiveId);
    if (!r) return;
    setAssignmentDraft(assignmentToDraft(r, subjects));
    setDialogOpen(true);
  }

  async function deleteLesson(id: string) {
    if (!token || !studio) return;
    if (!window.confirm('Bu ders ataması silinsin mi?')) return;
    await apiFetch(`/ders-dagit/studios/${studio.id}/assignments/${id}`, { token, method: 'DELETE' });
    toast.success('Silindi');
    if (listActiveId === id) setListActiveId(null);
    await load();
  }

  function loadToForm(r: Assignment) {
    setEditId(r.id);
    setSubject(r.subject_name);
    setSections(r.class_sections.length ? r.class_sections : ['5A']);
    setHours(r.weekly_hours);
    setTeacherIds(r.teacher_ids ?? []);
    setRoomId(r.room_ids?.[0] ?? '');
    setGroupId(r.group_id ?? '');
    setBiweekly(!!r.biweekly);
    setPlaceFirst(!!r.place_first);
    setMinDays(r.min_days_per_week ?? 2);
    setMaxPerDay(r.max_per_day ?? 2);
    setMaxDaysWeek(r.max_days_per_week ?? '');
    setFixedSlots(r.fixed_slots ?? []);
  }

  async function addAssignment() {
    if (!token || !studio || !subject.trim()) return;
    await apiFetch(`/ders-dagit/studios/${studio.id}/assignments`, {
      token,
      method: 'POST',
      body: {
        id: editId ?? undefined,
        subject_id: subjectId || null,
        subject_name: subject.trim(),
        options: {
          co_teach: coTeach,
          ...(blockLessons >= 2 ? { block_lessons: blockLessons } : {}),
          ...(placeOnDays.trim()
            ? {
                place_on_days: placeOnDays
                  .split(',')
                  .map((s) => Number(s.trim()))
                  .filter((n) => n >= 1 && n <= 7),
              }
            : {}),
        },
        class_sections:
          selectedGroup?.member_sections?.length && groupId ? selectedGroup.member_sections : sections,
        weekly_hours: hours,
        max_per_day: maxPerDay,
        max_days_per_week: maxDaysWeek === '' ? null : Number(maxDaysWeek),
        min_days_per_week: minDays,
        room_ids: roomId ? [roomId] : [],
        teacher_ids: teacherIds,
        group_id: groupId || null,
        biweekly,
        place_first: placeFirst,
        fixed_slots: fixedSlots,
      },
    });
    setSubject('');
    setEditId(null);
    setFixedSlots([]);
    await load();
    toast.success(editId ? 'Güncellendi' : 'Atama eklendi');
  }

  return (
    <div className={DD_PAGE}>
      <DdPageHeader
        icon={ListChecks}
        title="Ders atama"
        description="aSc akışı: atanan dersler listesi · Ders penceresi ile öğretmen, ders, sınıf, saat, derslik."
      />
      {scopeBanner && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <strong>Bireysel kapsam:</strong> {scopeBanner}
          <span className="ml-2 text-xs text-muted-foreground">
            ({scopedRows.length} / {rows.length} atama)
          </span>
          <Link href="/ders-dagit/studyo/atamalar" className="ml-2 text-xs text-primary underline">
            Tüm atamalar
          </Link>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
        <AssignedLessonsPanel
          title={panelTitle}
          rows={scopedRows}
          subjects={subjects}
          activeId={listActiveId}
          onSelect={setListActiveId}
          onNew={openNewLesson}
          onEdit={openEditLesson}
          onDelete={() => listActiveId && void deleteLesson(listActiveId)}
        />
        <p className="hidden text-xs text-muted-foreground lg:block">
          Sağdaki <strong>Ders</strong> penceresi yalnızca seçili öğretmen / şube / ders kapsamına uygulanır. Gelişmiş
          toplu içe aktarma altta.
        </p>
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

      <details className="rounded-lg border bg-muted/20 px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium">Toplu içe aktarma ve gelişmiş form</summary>
        <div className="mt-3 space-y-4">
      <DdCard>
        <CardHeader>
          <CardTitle className="text-base">e-Okul dosyasından yükle</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <DdSelect
              className="min-w-[200px] flex-1 sm:flex-none"
              value={eokulFormat}
              onValueChange={(v) => setEokulFormat(v as typeof eokulFormat)}
              options={EOKUL_FORMAT_OPTS}
            />
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="text-sm"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f || !token || !studio) return;
                void f.arrayBuffer().then((buf) => {
                  const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
                  setEokulB64(b64);
                  return apiFetch<NonNullable<typeof eokulPreview>>(
                    `/ders-dagit/studios/${studio.id}/import/eokul/preview`,
                    { token, method: 'POST', body: { file_base64: b64, format: eokulFormat } },
                  );
                }).then((p) => p && setEokulPreview(p));
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={async () => {
                if (!token || !studio) return;
                const { resolveDefaultApiBase } = await import('@/lib/resolve-api-base');
                const base = resolveDefaultApiBase().replace(/\/$/, '');
                const res = await fetch(`${base}/ders-dagit/studios/${studio.id}/assignments/eokul-template.xlsx`, {
                  headers: { Authorization: `Bearer ${token}` },
                });
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'eokul-ders-dagit-atama.xlsx';
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Şablon
            </Button>
          </div>
          {eokulPreview && (
            <>
              <p className="text-xs text-muted-foreground">
                Format: {eokulPreview.format} · {eokulPreview.rows.length} atama
              </p>
              {eokulPreview.warnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-700">
                  {w.message}
                </p>
              ))}
              <ul className="max-h-40 overflow-y-auto text-xs">
                {eokulPreview.rows.slice(0, 20).map((r, i) => (
                  <li key={i}>
                    {formatClassSectionsList(r.class_sections)} — {r.subject_name} ({r.weekly_hours} saat)
                    {r.match_warning ? ` ⚠ ${r.match_warning}` : ''}
                  </li>
                ))}
              </ul>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={autoElectiveGroups}
                  onChange={(e) => setAutoElectiveGroups(e.target.checked)}
                />
                Seçmeli ders satırlarından alt grup oluştur
              </label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={!eokulB64}
                  onClick={async () => {
                    if (!eokulB64 || !token || !studio) return;
                    const res = await apiFetch<{ imported: number; elective_pools_created?: number }>(
                      `/ders-dagit/studios/${studio.id}/import/eokul`,
                      {
                        token,
                        method: 'POST',
                        body: {
                          file_base64: eokulB64,
                          format: eokulFormat,
                          replace: false,
                          auto_elective_groups: autoElectiveGroups,
                        },
                      },
                    );
                    toast.success(
                      `${res.imported} atama${res.elective_pools_created ? ` · ${res.elective_pools_created} seçmeli havuz` : ''}`,
                    );
                    setEokulPreview(null);
                    setEokulB64(null);
                    await load();
                  }}
                >
                  İçe aktar (ekle)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={!eokulB64}
                  onClick={async () => {
                    if (!eokulB64 || !token || !studio) return;
                    const res = await apiFetch<{ imported: number; elective_pools_created?: number }>(
                      `/ders-dagit/studios/${studio.id}/import/eokul`,
                      {
                        token,
                        method: 'POST',
                        body: {
                          file_base64: eokulB64,
                          format: eokulFormat,
                          replace: true,
                          auto_elective_groups: autoElectiveGroups,
                        },
                      },
                    );
                    toast.success(
                      `${res.imported} atama${res.elective_pools_created ? ` · ${res.elective_pools_created} havuz` : ''}`,
                    );
                    setEokulPreview(null);
                    setEokulB64(null);
                    await load();
                  }}
                >
                  Değiştir (sil + aktar)
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </DdCard>
      <DdCard>
        <CardHeader>
          <CardTitle className="text-base">Ders kataloğundan atama</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={async () => {
              if (!token || !studio) return;
              const res = await apiFetch<{ created: number; updated?: number }>(
                `/ders-dagit/studios/${studio.id}/assignments/sync-from-subjects`,
                { token, method: 'POST', body: {} },
              );
              toast.success(`${res.created} yeni${res.updated ? `, ${res.updated} güncellendi` : ''}`);
              await load();
            }}
          >
            Katalogdan üret (ekle)
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={async () => {
              if (!token || !studio) return;
              const res = await apiFetch<{ created: number; updated?: number }>(
                `/ders-dagit/studios/${studio.id}/assignments/sync-from-subjects`,
                { token, method: 'POST', body: { replace: true } },
              );
              toast.success(`${res.created} atama (katalog yenilendi)`);
              await load();
            }}
          >
            Katalogdan değiştir
          </Button>
        </CardContent>
      </DdCard>
      <p className="text-xs text-muted-foreground">
        Okul planından ders + atama aktarımı için{' '}
        <a href="/ders-dagit/studyo/dersler" className="font-medium text-primary underline-offset-2 hover:underline">
          Dersler
        </a>{' '}
        sayfasındaki önizleme ve onay akışını kullanın.
      </p>
      <DdCard>
        <CardHeader>
          <CardTitle className="text-base">Paralel grup</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-2">
          <DdSelect
            className="min-w-[220px] flex-1"
            value={groupId}
            onValueChange={setGroupId}
            placeholder="Grup yok"
            options={[
              { value: '', label: 'Grup yok' },
              ...groups.map((g) => ({
                value: g.id,
                label: `${g.name} (${groupModeLabel(g.parallel_mode)})`,
              })),
            ]}
          />
          <Button type="button" size="sm" variant="outline" asChild>
            <Link href="/ders-dagit/studyo/gruplar">Grupları yönet</Link>
          </Button>
        </CardContent>
      </DdCard>
      <DdCard>
        <CardHeader>
          <CardTitle className="text-base">Yeni ders ataması</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={biweekly} onChange={(e) => setBiweekly(e.target.checked)} />
            İki haftada bir
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={placeFirst} onChange={(e) => setPlaceFirst(e.target.checked)} />
            Önce yerleştir
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={coTeach} onChange={(e) => setCoTeach(e.target.checked)} />
            Aynı saatte ortak öğretim
          </label>
          {(schoolType === 'mtal' || blockLessons > 0) && (
            <>
              <div>
                <Label>Blok ders (2–8 ardışık saat)</Label>
                <Input
                  type="number"
                  min={0}
                  max={8}
                  value={blockLessons || ''}
                  onChange={(e) => setBlockLessons(Number(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label>Yalnız günler (1–7)</Label>
                <Input
                  className="font-mono text-xs"
                  value={placeOnDays}
                  onChange={(e) => setPlaceOnDays(e.target.value)}
                  placeholder="1,2"
                />
              </div>
            </>
          )}
        </CardContent>
        <CardContent className="grid gap-3 border-t pt-3 sm:grid-cols-6">
          <div>
            <Label>Ders</Label>
            {subjects.length > 0 ? (
              <DdSelect
                value={subject}
                onValueChange={(name) => {
                  setSubject(name);
                  const s = subjects.find((x) => x.name === name);
                  setSubjectId(s?.id ?? '');
                }}
                placeholder="—"
                options={[
                  { value: '', label: '—' },
                  ...subjects.map((s) => ({ value: s.name, label: s.name })),
                ]}
              />
            ) : (
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Matematik" />
            )}
          </div>
          <DdSectionMultiField
            className="sm:col-span-2"
            label="Sınıflar / şubeler"
            value={sections}
            onValueChange={setSections}
            extraSections={rows.flatMap((r) => r.class_sections)}
          />
          <div>
            <Label>Haftalık saat</Label>
            <Input type="number" min={1} value={hours} onChange={(e) => setHours(Number(e.target.value))} />
          </div>
          <div>
            <Label>Öğretmen(ler)</Label>
            <DdMultiSelect
              value={teacherIds}
              onValueChange={setTeacherIds}
              rows={4}
              options={teachers.map((t) => ({
                value: t.user_id,
                label: t.display_name ?? t.user_id.slice(0, 8),
              }))}
            />
          </div>
          <div>
            <Label>Haftada en az gün</Label>
            <Input type="number" min={1} value={minDays} onChange={(e) => setMinDays(Number(e.target.value))} />
          </div>
          <div>
            <Label>Günde en fazla saat</Label>
            <Input type="number" min={1} value={maxPerDay} onChange={(e) => setMaxPerDay(Number(e.target.value))} />
          </div>
          <div>
            <Label>Haftada en fazla gün</Label>
            <Input
              type="number"
              min={1}
              max={6}
              value={maxDaysWeek}
              onChange={(e) => setMaxDaysWeek(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="—"
            />
          </div>
          <div>
            <Label>Derslik</Label>
            <DdSelect
              value={roomId}
              onValueChange={setRoomId}
              placeholder="—"
              options={[
                { value: '', label: '—' },
                ...rooms.map((r) => ({ value: r.id, label: r.name })),
              ]}
            />
          </div>
          <div className="flex flex-wrap items-end gap-2 sm:col-span-2">
            <DdSelect
              className="max-w-[120px]"
              value={String(fixDay)}
              onValueChange={(v) => setFixDay(Number(v))}
              options={FIX_DAY_OPTS}
            />
            <Input type="number" className="h-9 w-16" min={1} value={fixLesson} onChange={(e) => setFixLesson(Number(e.target.value))} />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setFixedSlots((p) => [...p, { day_of_week: fixDay, lesson_num: fixLesson }])}
            >
              + Sabit saat ekle
            </Button>
            <Button type="button" onClick={() => void addAssignment()}>
              {editId ? 'Güncelle' : 'Ekle'}
            </Button>
            {editId && (
              <Button type="button" variant="outline" onClick={() => setEditId(null)}>
                İptal
              </Button>
            )}
          </div>
          {fixedSlots.length > 0 && (
            <p className="text-xs text-muted-foreground sm:col-span-6">
              Sabit saatler: {fixedSlots.map((f) => `gün ${f.day_of_week}, ${f.lesson_num}. ders`).join(' · ')}
              <button type="button" className="ml-2 underline" onClick={() => setFixedSlots([])}>
                temizle
              </button>
            </p>
          )}
        </CardContent>
      </DdCard>
      <DdCard>
        <CardHeader>
          <CardTitle className="text-base">Excel toplu içe aktar</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={async () => {
              if (!token || !studio) return;
              const base = (await import('@/lib/resolve-api-base')).resolveDefaultApiBase().replace(/\/$/, '');
              const res = await fetch(`${base}/ders-dagit/studios/${studio.id}/assignments/import-template.xlsx`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'ders-dagit-atama-sablon.xlsx';
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Şablon indir
          </Button>
          <input
            type="file"
            accept=".xlsx,.xls"
            className="text-xs"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file || !token || !studio) return;
              const b64 = await new Promise<string>((resolve, reject) => {
                const r = new FileReader();
                r.onload = () => resolve((r.result as string).split(',')[1] ?? '');
                r.onerror = reject;
                r.readAsDataURL(file);
              });
              const res = await apiFetch<{ imported: number }>(
                `/ders-dagit/studios/${studio.id}/assignments/import-xlsx`,
                { token, method: 'POST', body: { file_base64: b64 } },
              );
              toast.success(`${res.imported} satır`);
              await load();
            }}
          />
        </CardContent>
      </DdCard>
      <DdCard>
        <CardHeader>
          <CardTitle className="text-base">CSV toplu içe aktar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            ders,sınıflar,saat,öğretmen_id|id,derslik_id,2hf,önce,min_gün,max_gün
          </p>
          <textarea
            className="min-h-[80px] w-full rounded-md border p-2 text-xs font-mono"
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder="Matematik,5A,4,user-uuid,,0,0,2,2"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={!csvText.trim()}
              onClick={async () => {
                if (!token || !studio) return;
                const res = await apiFetch<{ imported: number }>(
                  `/ders-dagit/studios/${studio.id}/assignments/import-csv`,
                  { token, method: 'POST', body: { csv: csvText } },
                );
                toast.success(`${res.imported} satır`);
                setCsvText('');
                await load();
              }}
            >
              İçe aktar
            </Button>
          </div>
        </CardContent>
      </DdCard>
        </div>
      </details>
    </div>
  );
}
