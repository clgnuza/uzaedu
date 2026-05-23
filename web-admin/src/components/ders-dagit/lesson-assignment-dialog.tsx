'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import {
  draftToApiBody,
  PERIOD_FORMAT_LABEL,
  ROOM_MODE_LABEL,
  suggestRooms,
  type LessonAssignmentDraft,
  type LessonPeriodFormat,
  type RoomPickMode,
} from '@/lib/lesson-assignment';
import { groupModeLabel } from '@/lib/ders-dagit-labels';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DdSelect, DdSelectField, DdMultiSelect } from '@/components/ders-dagit/dd-select';
import { Dialog, DialogFooter } from '@/components/ui/dialog';
import { DdAccentButton, DdDialogContent } from '@/components/ders-dagit/dd-ui';
import Link from 'next/link';
import { CheckIcon, HelpCircleIcon } from '@/components/icons';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Teacher = { user_id: string; display_name?: string };
type Subject = { id: string; name: string; short_code?: string | null };
type Room = {
  id: string;
  name: string;
  allowed_subjects?: string[] | null;
  allowed_class_sections?: string[] | null;
  allowed_teacher_ids?: string[] | null;
};
type Group = { id: string; name: string; parallel_mode: string | null; member_sections: string[] };

const EMPTY_DRAFT = (): LessonAssignmentDraft => ({
  subject_id: '',
  subject_name: '',
  primary_teacher_id: '',
  co_teacher_ids: [],
  section: '',
  joined_sections: [],
  use_joined: false,
  group_id: '',
  weekly_hours: 4,
  period_format: 'single',
  room_mode: 'class',
  room_ids: [],
  place_first: false,
  min_days_per_week: 2,
  max_per_day: 2,
});

const STEP_KEYS = ['teacher', 'lesson', 'class', 'time', 'room'] as const;
const STEP_LABELS: Record<(typeof STEP_KEYS)[number], string> = {
  teacher: 'Öğretmen',
  lesson: 'Ders',
  class: 'Şube',
  time: 'Saat',
  room: 'Derslik',
};

function FormBlock({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rounded-md border border-border/80 bg-card p-2.5', className)}>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studioId: string;
  token: string;
  draft: LessonAssignmentDraft | null;
  onDraftChange: (d: LessonAssignmentDraft) => void;
  teachers: Teacher[];
  subjects: Subject[];
  rooms: Room[];
  groups: Group[];
  sections: string[];
  onSaved: () => void;
  lockTeacherId?: string | null;
  lockRoomId?: string | null;
};

export function LessonAssignmentDialog({
  open,
  onOpenChange,
  studioId,
  token,
  draft,
  onDraftChange,
  teachers,
  subjects,
  rooms,
  groups,
  sections,
  onSaved,
  lockTeacherId,
  lockRoomId,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [showCoTeachers, setShowCoTeachers] = useState(false);
  const [showJoined, setShowJoined] = useState(false);
  const [showMoreRooms, setShowMoreRooms] = useState(false);

  const d = draft ?? EMPTY_DRAFT();

  useEffect(() => {
    if (open && draft) {
      setShowCoTeachers(draft.co_teacher_ids.length > 0);
      setShowJoined(draft.use_joined);
      let next = draft;
      if (lockTeacherId) next = { ...next, primary_teacher_id: lockTeacherId };
      if (lockRoomId) next = { ...next, room_ids: [lockRoomId], room_mode: 'class' };
      if (next !== draft) onDraftChange(next);
    }
  }, [open, draft?.id, lockTeacherId, lockRoomId]);

  const selectedGroup = useMemo(() => groups.find((g) => g.id === d.group_id), [groups, d.group_id]);

  const classSectionsForSave = useMemo(() => {
    if (selectedGroup?.member_sections?.length && d.group_id) return selectedGroup.member_sections;
    if (d.use_joined && d.joined_sections.length) return d.joined_sections;
    return d.section ? [d.section] : [];
  }, [d, selectedGroup]);

  const stepComplete = {
    teacher: !!d.primary_teacher_id,
    lesson: !!d.subject_name.trim(),
    class: classSectionsForSave.length > 0,
    time: d.weekly_hours >= 1,
    room: d.room_ids.length > 0 || d.room_mode === 'shared',
  };

  function patch(p: Partial<LessonAssignmentDraft>) {
    onDraftChange({ ...d, ...p });
  }

  function applyRoomMode(mode: RoomPickMode) {
    const ids = suggestRooms(mode, {
      section: d.section,
      subjectName: d.subject_name,
      teacherId: d.primary_teacher_id,
      rooms,
    });
    patch({ room_mode: mode, room_ids: ids });
  }

  async function save() {
    if (!d.subject_name.trim() || !classSectionsForSave.length) {
      toast.error('Ders ve en az bir şube gerekli');
      return;
    }
    if (!d.primary_teacher_id) {
      toast.error('Öğretmen seçin');
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/ders-dagit/studios/${studioId}/assignments`, {
        token,
        method: 'POST',
        body: { ...draftToApiBody(d), class_sections: classSectionsForSave },
      });
      toast.success(d.id ? 'Ders güncellendi' : 'Ders atandı');
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kayıt başarısız');
    } finally {
      setSaving(false);
    }
  }

  const roomOptions = rooms.map((r) => ({ value: r.id, label: r.name }));
  const periodOptions = (Object.keys(PERIOD_FORMAT_LABEL) as LessonPeriodFormat[]).map((k) => ({
    value: k,
    label: PERIOD_FORMAT_LABEL[k],
  }));

  const teacherOpts = [
    { value: '', label: '— Seçin —' },
    ...teachers.map((t) => ({ value: t.user_id, label: t.display_name ?? t.user_id.slice(0, 8) })),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DdDialogContent className="flex max-h-[min(88vh,640px)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <header className="shrink-0 border-b px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold">{d.id ? 'Atamayı düzenle' : 'Ders atama'}</h2>
              <p className="text-[11px] text-muted-foreground">Öğretmen, ders, şube, saat ve derslik</p>
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-0.5">
              {STEP_KEYS.map((key) => (
                <span
                  key={key}
                  title={STEP_LABELS[key]}
                  className={cn(
                    'inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-medium',
                    stepComplete[key]
                      ? 'bg-primary/12 text-primary'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {stepComplete[key] ? <CheckIcon className="size-2.5" size={10} /> : null}
                  {STEP_LABELS[key]}
                </span>
              ))}
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-muted/15 p-2.5">
          <div className="grid gap-2 sm:grid-cols-2">
            <FormBlock title="Öğretmen">
              <DdSelectField
                label="Ana öğretmen"
                value={d.primary_teacher_id}
                disabled={!!lockTeacherId}
                onValueChange={(v) => {
                  patch({ primary_teacher_id: v });
                  if (d.room_mode === 'teacher') applyRoomMode('teacher');
                }}
                options={teacherOpts}
              />
              {!lockTeacherId && (
                <>
                  <button
                    type="button"
                    className="text-[11px] font-medium text-primary hover:underline"
                    onClick={() => setShowCoTeachers((v) => !v)}
                  >
                    {showCoTeachers ? 'Ortak öğretmeni gizle' : '+ Ortak öğretmen'}
                  </button>
                  {showCoTeachers && (
                    <DdMultiSelect
                      value={d.co_teacher_ids}
                      onValueChange={(ids) => patch({ co_teacher_ids: ids })}
                      options={teachers
                        .filter((t) => t.user_id !== d.primary_teacher_id)
                        .map((t) => ({ value: t.user_id, label: t.display_name ?? t.user_id.slice(0, 8) }))}
                      rows={2}
                      placeholder="Ortak öğretmenler"
                    />
                  )}
                </>
              )}
            </FormBlock>

            <FormBlock title="Ders">
              <DdSelectField
                label="Katalog"
                value={d.subject_id}
                onValueChange={(id) => {
                  const s = subjects.find((x) => x.id === id);
                  patch({ subject_id: id, subject_name: s?.name ?? '' });
                  if (d.room_mode === 'subject') applyRoomMode('subject');
                }}
                options={subjects.map((s) => ({ value: s.id, label: s.name }))}
              />
            </FormBlock>

            <FormBlock title="Şube / grup" className="sm:col-span-2">
              <div className="grid gap-2 sm:grid-cols-2">
                {!showJoined ? (
                  <DdSelectField
                    label="Şube"
                    value={d.section}
                    onValueChange={(v) => {
                      patch({ section: v, use_joined: false });
                      if (d.room_mode === 'class') applyRoomMode('class');
                    }}
                    options={[{ value: '', label: '— Seçin —' }, ...sections.map((s) => ({ value: s, label: s }))]}
                  />
                ) : (
                  <div className="sm:col-span-1">
                    <DdMultiSelect
                      value={d.joined_sections}
                      onValueChange={(ids) => patch({ joined_sections: ids, use_joined: true })}
                      options={sections.map((s) => ({ value: s, label: s }))}
                      rows={2}
                      placeholder="Birleşik şubeler"
                    />
                  </div>
                )}
                <DdSelectField
                  label="Paralel grup"
                  value={d.group_id}
                  onValueChange={(v) => patch({ group_id: v })}
                  options={[
                    { value: '', label: 'Bütün sınıf' },
                    ...groups.map((g) => ({
                      value: g.id,
                      label: `${g.name} (${groupModeLabel(g.parallel_mode)})`,
                    })),
                  ]}
                />
              </div>
              <div className="flex flex-wrap gap-2 text-[11px]">
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => setShowJoined((v) => !v)}
                >
                  {showJoined ? 'Tek şube' : 'Birleşik şubeler'}
                </button>
                <Link href="/ders-dagit/studyo/gruplar" className="text-muted-foreground hover:text-foreground">
                  Gruplar
                </Link>
              </div>
            </FormBlock>

            <FormBlock title="Program">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[11px] text-muted-foreground">Haftalık</label>
                  <Input
                    type="number"
                    min={1}
                    max={40}
                    className="h-8 bg-background text-sm"
                    value={d.weekly_hours}
                    onChange={(e) => patch({ weekly_hours: Number(e.target.value) || 1 })}
                  />
                </div>
                <DdSelectField
                  label="Biçim"
                  value={d.period_format}
                  onValueChange={(v) => patch({ period_format: v as LessonPeriodFormat })}
                  options={periodOptions}
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-[11px]">
                <input
                  type="checkbox"
                  className="size-3.5 rounded border-input"
                  checked={d.place_first}
                  onChange={(e) => patch({ place_first: e.target.checked })}
                />
                Önce yerleştir
              </label>
            </FormBlock>

            <FormBlock title="Derslik">
              {!lockRoomId && (
                <div className="flex flex-wrap gap-1">
                  {(Object.keys(ROOM_MODE_LABEL) as RoomPickMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => applyRoomMode(mode)}
                      className={cn(
                        'rounded border px-2 py-1 text-[10px] font-medium',
                        d.room_mode === mode
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-background text-muted-foreground hover:bg-muted/50',
                      )}
                    >
                      {ROOM_MODE_LABEL[mode]}
                    </button>
                  ))}
                </div>
              )}
              {!lockRoomId && (
                <button
                  type="button"
                  className="text-[11px] text-primary hover:underline"
                  onClick={() => setShowMoreRooms((v) => !v)}
                >
                  {showMoreRooms ? 'Liste gizle' : 'Derslik seç'}
                </button>
              )}
              {!lockRoomId && (showMoreRooms || d.room_ids.length > 1) && (
                <DdMultiSelect
                  value={d.room_ids}
                  onValueChange={(ids) => patch({ room_ids: ids })}
                  options={roomOptions}
                  rows={2}
                  placeholder="Derslik"
                />
              )}
              {d.room_ids[0] && (
                <p className="truncate text-[11px] text-muted-foreground">
                  {rooms.find((r) => r.id === d.room_ids[0])?.name ?? '—'}
                  {d.room_ids.length > 1 ? ` +${d.room_ids.length - 1}` : ''}
                </p>
              )}
            </FormBlock>
          </div>
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t px-3 py-2 sm:justify-between">
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            İptal
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1 px-2 text-xs" asChild>
              <Link href="/ders-dagit/studyo/atamalar">
                <HelpCircleIcon className="size-3" size={12} />
                Gelişmiş
              </Link>
            </Button>
            <DdAccentButton type="button" size="sm" className="h-8 min-w-[4.5rem]" disabled={saving} onClick={() => void save()}>
              {saving ? '…' : 'Kaydet'}
            </DdAccentButton>
          </div>
        </DialogFooter>
      </DdDialogContent>
    </Dialog>
  );
}
