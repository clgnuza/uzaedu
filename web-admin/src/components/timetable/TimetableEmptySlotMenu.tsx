'use client';

import { Columns3, GraduationCap, MapPin, Plus, Trash2 } from 'lucide-react';
import { dayLabel } from '@/lib/ders-dagit-labels';
import { ContextMenuShell, MenuItem, MenuSep } from './TimetableContextMenuUi';
import { TimetableViewPreviewSubmenu } from './TimetableViewPreviewSubmenu';
import type { TimetableEmptySlotMenuHandlers } from '@/lib/timetable-cell-menu';
import type { EditorEntry } from '@/lib/ders-dagit-timetable-api';

export function TimetableEmptySlotMenu({
  day,
  lesson,
  x,
  y,
  onClose,
  handlers,
  filterHint,
}: {
  day: number;
  lesson: number;
  x: number;
  y: number;
  onClose: () => void;
  handlers: TimetableEmptySlotMenuHandlers;
  /** Aktif filtre varsa önizleme bağlamı */
  filterHint?: { mode: 'class' | 'teacher' | 'room'; id: string; entry: EditorEntry };
}) {
  const header = (
    <div className="border-b border-border px-3 py-2 leading-snug">
      <p className="font-semibold text-foreground">Boş saat</p>
      <p className="text-[10px] text-muted-foreground">
        {dayLabel(day)} · {lesson}. ders
      </p>
    </div>
  );

  const previewEntry: EditorEntry | null =
    filterHint?.entry ??
    (handlers.preview && handlers.filterMode && handlers.filterId
      ? ({
          id: '_hint',
          day_of_week: day,
          lesson_num: lesson,
          class_section: handlers.filterMode === 'class' ? handlers.filterId : '',
          subject: '',
          user_id: handlers.filterMode === 'teacher' ? handlers.filterId : null,
          room_id: handlers.filterMode === 'room' ? handlers.filterId : null,
        } as EditorEntry)
      : null);

  return (
    <ContextMenuShell x={x} y={y} onClose={onClose} header={header}>
      {handlers.onPlaceAt ? (
        <MenuItem
          icon={<Plus className="size-3.5" />}
          onClick={() => {
            handlers.onPlaceAt!(day, lesson);
            onClose();
          }}
        >
          Seçili dersi buraya yerleştir
        </MenuItem>
      ) : null}

      {handlers.onPlaceAt ? <MenuSep /> : null}

      {handlers.onClearColumn ? (
        <MenuItem
          destructive
          icon={<Columns3 className="size-3.5" />}
          onClick={() => {
            handlers.onClearColumn!(day);
            onClose();
          }}
        >
          Gün sütununu temizle
        </MenuItem>
      ) : null}

      {handlers.onClearLessonRow ? (
        <MenuItem
          destructive
          icon={<Trash2 className="size-3.5" />}
          onClick={() => {
            handlers.onClearLessonRow!();
            onClose();
          }}
        >
          Ders satırını temizle
        </MenuItem>
      ) : null}

      {handlers.preview && previewEntry ? (
        <>
          <MenuSep />
          <TimetableViewPreviewSubmenu
            entry={previewEntry}
            preview={handlers.preview}
            onOpenPreview={handlers.onOpenPreview}
            onNavigateView={handlers.onNavigateView}
            onClose={onClose}
          />
        </>
      ) : null}

      {handlers.onOpenConstraints ? (
        <>
          <MenuSep />
          <MenuItem icon={<MapPin className="size-3.5" />} onClick={() => { handlers.onOpenConstraints!(); onClose(); }}>
            Kısıtlamalar
          </MenuItem>
        </>
      ) : null}

      {!handlers.onPlaceAt && !handlers.onClearColumn && !handlers.preview ? (
        <p className="px-3 py-2 text-[10px] text-muted-foreground">
          Havuzdan ders seçin veya kartı sürükleyin.
        </p>
      ) : null}
    </ContextMenuShell>
  );
}
