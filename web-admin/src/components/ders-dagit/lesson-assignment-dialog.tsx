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
import { Label } from '@/components/ui/label';
import { DdSelect, DdSelectField, DdMultiSelect } from '@/components/ders-dagit/dd-select';
import { Dialog, DialogFooter } from '@/components/ui/dialog';
import { DdAccentButton, DdDialogContent } from '@/components/ders-dagit/dd-ui';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  BookOpen,
  Calendar,
  Check,
  ChevronRight,
  DoorOpen,
  GraduationCap,
  HelpCircle,
  Sparkles,
  Users,
} from 'lucide-react';
import Link from 'next/link';

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

const STEPS = [
  { icon: GraduationCap, label: 'Öğretmen', key: 'teacher' },
  { icon: BookOpen, label: 'Ders', key: 'lesson' },
  { icon: Users, label: 'Sınıf', key: 'class' },
  { icon: Calendar, label: 'Saat', key: 'time' },
  { icon: DoorOpen, label: 'Derslik', key: 'room' },
] as const;

function StepCard({
  step,
  index,
  title,
  hint,
  children,
  action,
  complete,
}: {
  step: (typeof STEPS)[number];
  index: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  complete?: boolean;
}) {
  const Icon = step.icon;
  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-xl border transition-shadow',
        complete
          ? 'border-primary/25 bg-gradient-to-br from-primary/[0.06] to-transparent shadow-sm'
          : 'border-border/80 bg-card/80',
      )}
    >
      <div className="flex gap-0">
        <div
          className={cn(
            'flex w-14 shrink-0 flex-col items-center gap-1 border-r py-4',
            complete ? 'border-primary/20 bg-primary/5' : 'border-border/60 bg-muted/30',
          )}
        >
          <span
            className={cn(
              'flex size-7 items-center justify-center rounded-full text-[11px] font-bold tabular-nums',
              complete ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
            )}
          >
            {complete ? <Check className="size-3.5" strokeWidth={3} /> : index + 1}
          </span>
          <Icon className={cn('size-5', complete ? 'text-primary' : 'text-muted-foreground')} aria-hidden />
          <span className="max-w-[3rem] text-center text-[9px] font-semibold uppercase leading-tight tracking-wide text-muted-foreground">
            {step.label}
          </span>
        </div>
        <div className="min-w-0 flex-1 p-3.5">
          <div className="mb-2.5 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h4 className="text-sm font-semibold">{title}</h4>
              {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
            </div>
            {action}
          </div>
          <div className="space-y-2.5">{children}</div>
        </div>
      </div>
    </section>
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
  /** Öğretmen sayfasından: öğretmen alanı kilitli */
  lockTeacherId?: string | null;
  /** Derslik sayfasından: derslik alanı kilitli */
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
  const primaryTeacher = teachers.find((t) => t.user_id === d.primary_teacher_id);
  const selectedSubject = subjects.find((s) => s.id === d.subject_id);

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

  const headerSubtitle = [
    primaryTeacher?.display_name,
    selectedSubject?.name,
    classSectionsForSave[0],
    d.weekly_hours ? `${d.weekly_hours} saat` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DdDialogContent className="max-h-[92vh] max-w-xl gap-0 overflow-hidden p-0 sm:max-w-xl">
        <header className="relative overflow-hidden border-b px-5 py-4">
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/15 via-teal-500/10 to-violet-500/5"
            aria-hidden
          />
          <div className="relative flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/20 text-primary shadow-inner ring-1 ring-primary/20">
              <Sparkles className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-primary/80">Ders atama</p>
              <h2 className="text-lg font-semibold tracking-tight">{d.id ? 'Atamayı düzenle' : 'Yeni ders'}</h2>
              {headerSubtitle ? (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{headerSubtitle}</p>
              ) : (
                <p className="mt-0.5 text-xs text-muted-foreground">Öğretmen → ders → sınıf → saat → derslik</p>
              )}
            </div>
          </div>
          <div className="relative mt-3 flex flex-wrap gap-1">
            {STEPS.map((s, i) => (
              <span
                key={s.key}
                className={cn(
                  'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium',
                  stepComplete[s.key]
                    ? 'bg-primary/15 text-primary'
                    : 'bg-muted/80 text-muted-foreground',
                )}
              >
                {stepComplete[s.key] ? <Check className="size-2.5" /> : <span className="opacity-50">{i + 1}.</span>}
                {s.label}
                {i < STEPS.length - 1 ? <ChevronRight className="size-2.5 opacity-40" /> : null}
              </span>
            ))}
          </div>
        </header>

        <div className="max-h-[min(68vh,580px)] space-y-2.5 overflow-y-auto bg-muted/20 p-3.5">
          <StepCard
            step={STEPS[0]}
            index={0}
            title="Öğretmen"
            hint={lockTeacherId ? 'Bu sayfada seçili öğretmen sabit' : 'Ana öğretmeni seçin'}
            complete={stepComplete.teacher}
            action={
              !lockTeacherId ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => setShowCoTeachers((v) => !v)}
                >
                  Ortak öğretmen
                </Button>
              ) : null
            }
          >
            <DdSelectField
              label="Öğretmen"
              value={d.primary_teacher_id}
              disabled={!!lockTeacherId}
              onValueChange={(v) => {
                patch({ primary_teacher_id: v });
                if (d.room_mode === 'teacher') applyRoomMode('teacher');
              }}
              options={[
                { value: '', label: '— Seçin —' },
                ...teachers.map((t) => ({
                  value: t.user_id,
                  label: t.display_name ?? t.user_id.slice(0, 8),
                })),
              ]}
            />
            {showCoTeachers && !lockTeacherId && (
              <DdMultiSelect
                value={d.co_teacher_ids}
                onValueChange={(ids) => patch({ co_teacher_ids: ids })}
                options={teachers
                  .filter((t) => t.user_id !== d.primary_teacher_id)
                  .map((t) => ({ value: t.user_id, label: t.display_name ?? t.user_id.slice(0, 8) }))}
                rows={3}
                placeholder="Ortak öğretmenler"
              />
            )}
          </StepCard>

          <StepCard step={STEPS[1]} index={1} title="Ders" hint="Katalogdan ders seçin" complete={stepComplete.lesson}>
            <DdSelectField
              label="Ders"
              value={d.subject_id}
              onValueChange={(id) => {
                const s = subjects.find((x) => x.id === id);
                patch({ subject_id: id, subject_name: s?.name ?? '' });
                if (d.room_mode === 'subject') applyRoomMode('subject');
              }}
              options={subjects.map((s) => ({ value: s.id, label: s.name }))}
            />
          </StepCard>

          <StepCard
            step={STEPS[2]}
            index={2}
            title="Sınıf / şube"
            hint="Tek şube, birleşik sınıf veya grup"
            complete={stepComplete.class}
            action={
              <div className="flex flex-col gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => setShowJoined((v) => !v)}
                >
                  Birleşik sınıflar
                </Button>
                <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" asChild>
                  <Link href="/ders-dagit/studyo/gruplar">Grup ekle</Link>
                </Button>
              </div>
            }
          >
            {!showJoined ? (
              <DdSelectField
                label="Şube"
                value={d.section}
                onValueChange={(v) => {
                  patch({ section: v, use_joined: false });
                  if (d.room_mode === 'class') applyRoomMode('class');
                }}
                options={[
                  { value: '', label: '— Seçin —' },
                  ...sections.map((s) => ({ value: s, label: s })),
                ]}
              />
            ) : (
              <DdMultiSelect
                value={d.joined_sections}
                onValueChange={(ids) => patch({ joined_sections: ids, use_joined: true })}
                options={sections.map((s) => ({ value: s, label: s }))}
                rows={4}
                placeholder="Birleşik şubeler"
              />
            )}
            <DdSelect
              className="w-full"
              value={d.group_id}
              onValueChange={(v) => patch({ group_id: v })}
              placeholder="Bütün sınıf"
              options={[
                { value: '', label: 'Bütün sınıf' },
                ...groups.map((g) => ({
                  value: g.id,
                  label: `${g.name} (${groupModeLabel(g.parallel_mode)})`,
                })),
              ]}
            />
          </StepCard>

          <StepCard step={STEPS[3]} index={3} title="Haftalık program" hint="Ders saati ve yerleşim biçimi" complete={stepComplete.time}>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Haftalık ders</Label>
                <Input
                  type="number"
                  min={1}
                  max={40}
                  className="h-9 bg-background"
                  value={d.weekly_hours}
                  onChange={(e) => patch({ weekly_hours: Number(e.target.value) || 1 })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Biçim</Label>
                <DdSelect
                  className="w-full"
                  value={d.period_format}
                  onValueChange={(v) => patch({ period_format: v as LessonPeriodFormat })}
                  options={periodOptions}
                />
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border bg-background px-3 py-2 text-xs">
              <input
                type="checkbox"
                className="size-3.5 rounded border-primary text-primary"
                checked={d.place_first}
                onChange={(e) => patch({ place_first: e.target.checked })}
              />
              <span>Önce yerleştir (programda öncelikli)</span>
            </label>
          </StepCard>

          <StepCard
            step={STEPS[4]}
            index={4}
            title="Derslik"
            hint={lockRoomId ? 'Bu sayfada seçili derslik sabit' : 'Otomatik öneri veya elle seçim'}
            complete={stepComplete.room}
            action={
              !lockRoomId ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => setShowMoreRooms((v) => !v)}
                >
                  Daha fazla derslik
                </Button>
              ) : undefined
            }
          >
            {!lockRoomId && (
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(ROOM_MODE_LABEL) as RoomPickMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => applyRoomMode(mode)}
                    className={cn(
                      'rounded-lg border px-2.5 py-2 text-left text-[11px] font-medium transition-all',
                      d.room_mode === mode
                        ? 'border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20'
                        : 'border-border bg-background hover:border-primary/30 hover:bg-muted/50',
                    )}
                  >
                    {ROOM_MODE_LABEL[mode]}
                  </button>
                ))}
              </div>
            )}
            {!lockRoomId && (showMoreRooms || d.room_ids.length > 0) && (
              <DdMultiSelect
                value={d.room_ids}
                onValueChange={(ids) => patch({ room_ids: ids })}
                options={roomOptions}
                rows={3}
                placeholder="Derslik seçin"
              />
            )}
            {d.room_ids[0] && !showMoreRooms && (
              <p className="flex items-center gap-1.5 rounded-md bg-background px-2 py-1.5 text-xs text-muted-foreground">
                <DoorOpen className="size-3.5 shrink-0" aria-hidden />
                {rooms.find((r) => r.id === d.room_ids[0])?.name ?? d.room_ids[0]}
              </p>
            )}
          </StepCard>
        </div>

        <DialogFooter className="gap-2 border-t bg-card/90 px-4 py-3 sm:justify-between">
          <Button type="button" variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={() => onOpenChange(false)}>
            İptal
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" className="gap-1" asChild>
              <Link href="/ders-dagit/studyo/atamalar">
                <HelpCircle className="size-3.5" />
                Gelişmiş
              </Link>
            </Button>
            <DdAccentButton type="button" size="sm" className="min-w-[5.5rem] shadow-md" disabled={saving} onClick={() => void save()}>
              {saving ? 'Kaydediliyor…' : 'Tamam'}
            </DdAccentButton>
          </div>
        </DialogFooter>
      </DdDialogContent>
    </Dialog>
  );
}
