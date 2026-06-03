'use client';

import { DoorOpen, GraduationCap, Maximize2, UserRound } from 'lucide-react';
import { TimetableMiniPreview } from './TimetableMiniPreview';
import { SubMenu, MenuItem } from './TimetableContextMenuUi';
import { filterEntriesForPreview } from '@/lib/timetable-preview-filter';
import type { TimetablePreviewTarget } from '@/lib/timetable-preview-types';
import type { EditorEntry } from '@/lib/ders-dagit-timetable-api';

type PreviewCtx = {
  entries: EditorEntry[];
  workDays: number[];
  maxLesson: number;
};

function PreviewRow({
  mode,
  id,
  title,
  subtitle,
  icon,
  preview,
  onOpenPreview,
  onNavigate,
  onClose,
}: {
  mode: 'class' | 'teacher' | 'room';
  id: string;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  preview: PreviewCtx;
  onOpenPreview?: (t: TimetablePreviewTarget) => void;
  onNavigate?: (mode: 'class' | 'teacher' | 'room', id: string) => void;
  onClose: () => void;
}) {
  const filtered = filterEntriesForPreview(preview.entries, mode, id);
  return (
    <div
      className="group relative border-b border-border/50 last:border-0"
      onMouseEnter={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1 pr-1">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left hover:bg-muted"
          onClick={() => {
            onNavigate?.(mode, id);
            onClose();
          }}
        >
          <span className="size-3.5 shrink-0 opacity-70">{icon}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{title}</span>
            {subtitle ? <span className="block truncate text-[9px] text-muted-foreground">{subtitle}</span> : null}
          </span>
        </button>
        {onOpenPreview ? (
          <button
            type="button"
            title="Büyük önizleme"
            className="shrink-0 rounded p-1 opacity-60 hover:bg-muted hover:opacity-100"
            onClick={() => {
              onOpenPreview({ mode, id, title, subtitle });
              onClose();
            }}
          >
            <Maximize2 className="size-3" />
          </button>
        ) : null}
      </div>
      <div className="pointer-events-none absolute left-full top-0 z-[220] ml-1 hidden w-[232px] group-hover:block">
        <TimetableMiniPreview
          title={title}
          subtitle={subtitle}
          entries={filtered}
          workDays={preview.workDays}
          maxLesson={preview.maxLesson}
          viewMode={mode}
          compact
        />
      </div>
    </div>
  );
}

export function TimetableViewPreviewSubmenu({
  entry,
  preview,
  onOpenPreview,
  onNavigateView,
  onClose,
}: {
  entry: EditorEntry;
  preview: PreviewCtx;
  onOpenPreview?: (t: TimetablePreviewTarget) => void;
  onNavigateView?: (mode: 'class' | 'teacher' | 'room', id: string) => void;
  onClose: () => void;
}) {
  const teacherName = entry.teacher_label?.trim() || 'Öğretmen';
  const roomName = entry.room_name?.trim() || 'Derslik';

  return (
    <SubMenu label="Görünüm" icon={<GraduationCap className="size-3.5" />} wide>
      <div className="w-[240px] py-0.5">
        <PreviewRow
          mode="class"
          id={entry.class_section}
          title={entry.class_section}
          subtitle="Sınıf çizelgesi"
          icon={<GraduationCap className="size-3.5" />}
          preview={preview}
          onOpenPreview={onOpenPreview}
          onNavigate={onNavigateView}
          onClose={onClose}
        />
        {entry.user_id ? (
          <PreviewRow
            mode="teacher"
            id={entry.user_id}
            title={teacherName}
            subtitle="Öğretmen çizelgesi"
            icon={<UserRound className="size-3.5" />}
            preview={preview}
            onOpenPreview={onOpenPreview}
            onNavigate={onNavigateView}
            onClose={onClose}
          />
        ) : null}
        {entry.room_id ? (
          <PreviewRow
            mode="room"
            id={entry.room_id}
            title={roomName}
            subtitle="Derslik çizelgesi"
            icon={<DoorOpen className="size-3.5" />}
            preview={preview}
            onOpenPreview={onOpenPreview}
            onNavigate={onNavigateView}
            onClose={onClose}
          />
        ) : null}
        {!entry.user_id && !entry.room_id ? (
          <p className="px-3 py-2 text-[10px] text-muted-foreground">Öğretmen veya derslik atanmamış.</p>
        ) : null}
      </div>
    </SubMenu>
  );
}
