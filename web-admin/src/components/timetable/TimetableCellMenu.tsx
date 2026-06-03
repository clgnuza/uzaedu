'use client';

import {
  AlertTriangle,
  ClipboardList,
  Combine,
  DoorOpen,
  Eye,
  GraduationCap,
  Lock,
  LockOpen,
  Maximize2,
  Pencil,
  ShieldCheck,
  Split,
  Trash2,
  UserRound,
  Zap,
} from 'lucide-react';
import { dayLabel } from '@/lib/ders-dagit-labels';
import { findConsecutivePartner } from '@/lib/timetable-double-block';
import type { EditorEntry } from '@/lib/ders-dagit-timetable-api';
import type { TimetableCellMenuHandlers } from '@/lib/timetable-cell-menu';
import type { TimetablePreviewTarget } from '@/lib/timetable-preview-types';
import { entryCellColor } from '@/lib/timetable-colors';
import {
  ContextActionBtn,
  ContextMenuShell,
  MenuItem,
  MenuSectionTitle,
  MenuSep,
  SubMenu,
} from './TimetableContextMenuUi';

export function TimetableCellMenu({
  entry,
  x,
  y,
  onClose,
  handlers,
  allEntries = [],
  assignmentSlotCount = 0,
  lessonRowCount = 0,
  clearSlotIds = [],
  hasClash = false,
  noRoom = false,
}: {
  entry: EditorEntry;
  x: number;
  y: number;
  onClose: () => void;
  handlers: TimetableCellMenuHandlers;
  allEntries?: EditorEntry[];
  assignmentSlotCount?: number;
  lessonRowCount?: number;
  clearSlotIds?: string[];
  hasClash?: boolean;
  noRoom?: boolean;
}) {
  const partner = findConsecutivePartner(entry, allEntries);
  const canRemoveAll = Boolean(entry.assignment_id && assignmentSlotCount > 1 && handlers.onRemoveAssignmentSlots);
  const canMerge = Boolean(handlers.onMergeDoubles && !partner);
  const canSplit = Boolean(handlers.onSplitDoubles && partner);
  const colors = entryCellColor(entry, 'class');
  const preview = handlers.preview;

  const openPreview = (target: TimetablePreviewTarget) => {
    handlers.onOpenPreview?.(target);
    onClose();
  };

  const header = (
    <div
      className="border-b border-border/60 px-3 py-3"
      style={{
        background: `linear-gradient(135deg, color-mix(in srgb, ${colors.border} 14%, transparent) 0%, transparent 70%)`,
      }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Ders kartı</p>
      <p className="mt-1 truncate text-sm font-semibold text-foreground">{entry.subject}</p>
      <p className="truncate text-xs text-muted-foreground">{entry.class_section}</p>
      {entry.teacher_label ? (
        <p className="truncate text-[11px] text-muted-foreground">{entry.teacher_label}</p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-1">
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums">
          {dayLabel(entry.day_of_week)} · {entry.lesson_num}. saat
        </span>
        {entry.room_name ? (
          <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-800 dark:text-emerald-200">
            {entry.room_name}
          </span>
        ) : noRoom ? (
          <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-800">Derslik yok</span>
        ) : null}
        {entry.is_locked ? (
          <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-900">Kilitli</span>
        ) : null}
        {hasClash ? (
          <span className="rounded-md bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive">Çakışma</span>
        ) : null}
        {partner ? (
          <span className="rounded-md bg-sky-500/10 px-1.5 py-0.5 text-[10px] text-sky-800">Çiftli blok</span>
        ) : null}
      </div>
    </div>
  );

  return (
    <ContextMenuShell x={x} y={y} onClose={onClose} header={header}>
      <div className="py-1">
        <ContextActionBtn
          icon={<Pencil className="size-4" />}
          label="Dersi düzenle…"
          hint="Gün, saat, derslik, kilit ve tüm bilgiler"
          onClick={() => {
            handlers.onEdit(entry);
            onClose();
          }}
        />
        {handlers.onLock ? (
          <ContextActionBtn
            icon={entry.is_locked ? <LockOpen className="size-4" /> : <Lock className="size-4" />}
            label={entry.is_locked ? 'Kilidi aç' : 'Kartı kilitle'}
            onClick={() => {
              handlers.onLock!(entry.id, !entry.is_locked);
              onClose();
            }}
          />
        ) : null}
      </div>

      {preview && handlers.onOpenPreview ? (
        <>
          <MenuSep />
          <MenuSectionTitle>Önizle</MenuSectionTitle>
          <ContextActionBtn
            icon={<Maximize2 className="size-4" />}
            label="Sınıf programı"
            hint={entry.class_section}
            onClick={() =>
              openPreview({
                mode: 'class',
                id: entry.class_section,
                title: entry.class_section,
                subtitle: 'Sınıf çizelgesi',
              })
            }
          />
          {entry.user_id ? (
            <ContextActionBtn
              icon={<Eye className="size-4" />}
              label="Öğretmen programı"
              hint={entry.teacher_label?.trim() || 'Öğretmen'}
              onClick={() =>
                openPreview({
                  mode: 'teacher',
                  id: entry.user_id!,
                  title: entry.teacher_label?.trim() || 'Öğretmen',
                  subtitle: 'Öğretmen çizelgesi',
                })
              }
            />
          ) : null}
          {entry.room_id ? (
            <ContextActionBtn
              icon={<DoorOpen className="size-4" />}
              label="Derslik programı"
              hint={entry.room_name?.trim() || 'Derslik'}
              onClick={() =>
                openPreview({
                  mode: 'room',
                  id: entry.room_id!,
                  title: entry.room_name?.trim() || 'Derslik',
                  subtitle: 'Derslik çizelgesi',
                })
              }
            />
          ) : null}
        </>
      ) : null}

      {(handlers.onFindClass || handlers.onFindTeacher || handlers.onFindRoom) && (
        <>
          <MenuSep />
          <MenuSectionTitle>Görünüme git</MenuSectionTitle>
          {handlers.onFindClass ? (
            <ContextActionBtn
              icon={<GraduationCap className="size-4" />}
              label="Sınıf filtresi"
              hint={entry.class_section}
              onClick={() => {
                handlers.onFindClass!(entry);
                onClose();
              }}
            />
          ) : null}
          {handlers.onFindTeacher && entry.user_id ? (
            <ContextActionBtn
              icon={<UserRound className="size-4" />}
              label="Öğretmen filtresi"
              onClick={() => {
                handlers.onFindTeacher!(entry);
                onClose();
              }}
            />
          ) : null}
          {handlers.onFindRoom && entry.room_id ? (
            <ContextActionBtn
              icon={<DoorOpen className="size-4" />}
              label="Derslik filtresi"
              onClick={() => {
                handlers.onFindRoom!(entry);
                onClose();
              }}
            />
          ) : null}
        </>
      )}

      <MenuSep />
      <SubMenu label="Hızlı işlemler" icon={<Zap className="size-3.5" />} wide>
        {handlers.onDelete ? (
          <MenuItem
            destructive
            icon={<Trash2 className="size-3.5" />}
            onClick={() => {
              handlers.onDelete!(entry.id);
              onClose();
            }}
          >
            Bu kartı kaldır
          </MenuItem>
        ) : null}
        {canRemoveAll ? (
          <MenuItem
            destructive
            onClick={() => {
              handlers.onRemoveAssignmentSlots!(entry);
              onClose();
            }}
          >
            Tüm atama kartları ({assignmentSlotCount})
          </MenuItem>
        ) : null}
        {handlers.onChangeRoom && handlers.rooms && handlers.rooms.length > 0 ? (
          <>
            <MenuSep />
            {handlers.rooms.slice(0, 14).map((r) => (
              <MenuItem
                key={r.id}
                onClick={() => {
                  handlers.onChangeRoom!(entry.id, r.id);
                  onClose();
                }}
              >
                {r.name}
                {entry.room_id === r.id ? ' ✓' : ''}
              </MenuItem>
            ))}
            <MenuItem
              onClick={() => {
                handlers.onChangeRoom!(entry.id, null);
                onClose();
              }}
            >
              Derslik kaldır
            </MenuItem>
          </>
        ) : null}
        {canMerge ? (
          <MenuItem
            icon={<Combine className="size-3.5" />}
            onClick={() => {
              handlers.onMergeDoubles!(entry);
              onClose();
            }}
          >
            Sonraki saatle çiftli yap
          </MenuItem>
        ) : null}
        {canSplit ? (
          <MenuItem
            icon={<Split className="size-3.5" />}
            onClick={() => {
              handlers.onSplitDoubles!(entry);
              onClose();
            }}
          >
            Çiftliyi ayır
          </MenuItem>
        ) : null}
      </SubMenu>

      {handlers.onClearSlots && lessonRowCount > 0 ? (
        <ContextActionBtn
          icon={<AlertTriangle className="size-4" />}
          label={`Satırı temizle (${lessonRowCount})`}
          destructive
          onClick={() => {
            handlers.onClearSlots!(clearSlotIds);
            onClose();
          }}
        />
      ) : null}

      {(handlers.onOpenAssignments || handlers.onOpenValidation) && (
        <>
          <MenuSep />
          {handlers.onOpenAssignments ? (
            <ContextActionBtn
              icon={<ClipboardList className="size-4" />}
              label="Atamaya git"
              onClick={() => {
                handlers.onOpenAssignments!(entry);
                onClose();
              }}
            />
          ) : null}
          {handlers.onOpenValidation ? (
            <ContextActionBtn
              icon={<ShieldCheck className="size-4" />}
              label="Planlama kontrolü"
              onClick={() => {
                handlers.onOpenValidation!();
                onClose();
              }}
            />
          ) : null}
        </>
      )}
    </ContextMenuShell>
  );
}
