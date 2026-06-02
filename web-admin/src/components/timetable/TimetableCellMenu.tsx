'use client';

import {
  ClipboardList,
  Combine,
  DoorOpen,
  Lock,
  LockOpen,
  Pencil,
  Search,
  ShieldCheck,
  Split,
  Trash2,
  Zap,
} from 'lucide-react';
import { dayLabel } from '@/lib/ders-dagit-labels';
import { findConsecutivePartner } from '@/lib/timetable-double-block';
import type { EditorEntry } from '@/lib/ders-dagit-timetable-api';
import type { TimetableCellMenuHandlers } from '@/lib/timetable-cell-menu';
import { ContextMenuShell, MenuItem, MenuSep, SubMenu } from './TimetableContextMenuUi';
import { TimetableViewPreviewSubmenu } from './TimetableViewPreviewSubmenu';

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
}) {
  const partner = findConsecutivePartner(entry, allEntries);
  const canRemoveAll = Boolean(entry.assignment_id && assignmentSlotCount > 1 && handlers.onRemoveAssignmentSlots);
  const canMerge = Boolean(handlers.onMergeDoubles && !partner);
  const canSplit = Boolean(handlers.onSplitDoubles && partner);

  const header = (
    <div className="border-b border-border px-3 py-2 leading-snug">
      <p className="truncate font-semibold text-foreground">
        {entry.subject}
        <span className="font-normal text-muted-foreground"> ({entry.class_section})</span>
      </p>
      <p className="text-[10px] text-muted-foreground">
        {dayLabel(entry.day_of_week)} · {entry.lesson_num}. ders
        {entry.is_locked ? ' · kilitli' : ''}
        {partner ? ' · çiftli' : ''}
      </p>
    </div>
  );

  return (
    <ContextMenuShell x={x} y={y} onClose={onClose} header={header}>
      {handlers.onLock ? (
        <MenuItem
          icon={entry.is_locked ? <LockOpen className="size-3.5" /> : <Lock className="size-3.5" />}
          onClick={() => {
            handlers.onLock!(entry.id, !entry.is_locked);
            onClose();
          }}
        >
          {entry.is_locked ? 'Kilidi aç' : 'Kartı kilitle'}
        </MenuItem>
      ) : null}

      <MenuItem
        icon={<Pencil className="size-3.5" />}
        onClick={() => {
          handlers.onEdit(entry);
          onClose();
        }}
      >
        Dersi güncelle…
      </MenuItem>

      <MenuSep />

      <SubMenu label="Hızlı değişiklik" icon={<Zap className="size-3.5" />} wide>
        {handlers.onDelete ? (
          <MenuItem
            destructive
            icon={<Trash2 className="size-3.5" />}
            onClick={() => {
              handlers.onDelete!(entry.id);
              onClose();
            }}
          >
            Sadece bu kartı kaldır
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
            Tüm atama kartlarını kaldır ({assignmentSlotCount})
          </MenuItem>
        ) : null}
        {handlers.onChangeRoom && handlers.rooms && handlers.rooms.length > 0 ? (
          <>
            <MenuSep />
            <MenuItem
              onClick={() => {
                handlers.onChangeRoom!(entry.id, null);
                onClose();
              }}
            >
              Derslik — kaldır
            </MenuItem>
            {handlers.rooms.slice(0, 12).map((r) => (
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
          </>
        ) : null}
        {(canMerge || canSplit) && <MenuSep />}
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
            Çiftliyi iki tekliye böl
          </MenuItem>
        ) : null}
      </SubMenu>

      {handlers.onClearSlots && lessonRowCount > 0 ? (
        <MenuItem
          destructive
          onClick={() => {
            handlers.onClearSlots!(clearSlotIds);
            onClose();
          }}
        >
          Satırı temizle ({lessonRowCount})
        </MenuItem>
      ) : null}

      {handlers.onChangeRoom && handlers.rooms && handlers.rooms.length > 0 ? (
        <>
          <MenuSep />
          <SubMenu label="Derslik" icon={<DoorOpen className="size-3.5" />}>
            <MenuItem
              onClick={() => {
                handlers.onChangeRoom!(entry.id, null);
                onClose();
              }}
            >
              Derslik yok
            </MenuItem>
            {handlers.rooms.map((r) => (
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
          </SubMenu>
        </>
      ) : null}

      {(handlers.onFindClass || handlers.onFindTeacher || handlers.onFindRoom) && (
        <>
          <MenuSep />
          <SubMenu label="Bul" icon={<Search className="size-3.5" />}>
            {handlers.onFindClass ? (
              <MenuItem
                onClick={() => {
                  handlers.onFindClass!(entry);
                  onClose();
                }}
              >
                Sınıf — {entry.class_section}
              </MenuItem>
            ) : null}
            {handlers.onFindTeacher && entry.user_id ? (
              <MenuItem
                onClick={() => {
                  handlers.onFindTeacher!(entry);
                  onClose();
                }}
              >
                Öğretmen — {entry.teacher_label?.trim() || '—'}
              </MenuItem>
            ) : null}
            {handlers.onFindRoom && entry.room_id ? (
              <MenuItem
                onClick={() => {
                  handlers.onFindRoom!(entry);
                  onClose();
                }}
              >
                Derslik — {entry.room_name?.trim() || '—'}
              </MenuItem>
            ) : null}
          </SubMenu>
        </>
      )}

      {handlers.preview ? (
        <>
          <MenuSep />
          <TimetableViewPreviewSubmenu
            entry={entry}
            preview={handlers.preview}
            onOpenPreview={handlers.onOpenPreview}
            onNavigateView={handlers.onNavigateView}
            onClose={onClose}
          />
        </>
      ) : null}

      {handlers.onOpenAssignments || handlers.onOpenValidation ? (
        <>
          <MenuSep />
          {handlers.onOpenAssignments ? (
            <MenuItem
              icon={<ClipboardList className="size-3.5" />}
              onClick={() => {
                handlers.onOpenAssignments!(entry);
                onClose();
              }}
            >
              Atamaya git
            </MenuItem>
          ) : null}
          {handlers.onOpenValidation ? (
            <MenuItem
              icon={<ShieldCheck className="size-3.5" />}
              onClick={() => {
                handlers.onOpenValidation!();
                onClose();
              }}
            >
              Planlama kontrolü
            </MenuItem>
          ) : null}
        </>
      ) : null}
    </ContextMenuShell>
  );
}
