'use client';

import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TimetableMiniPreview } from './TimetableMiniPreview';
import type { EditorEntry } from '@/lib/ders-dagit-timetable-api';

import type { TimetablePreviewTarget } from '@/lib/timetable-preview-types';

export type { TimetablePreviewTarget };

export function TimetablePreviewDialog({
  open,
  onOpenChange,
  target,
  entries,
  workDays,
  maxLesson,
  neighbors,
  onSelectNeighbor,
  onOpenFullView,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: TimetablePreviewTarget | null;
  entries: EditorEntry[];
  workDays: number[];
  maxLesson: number;
  neighbors?: { prev?: TimetablePreviewTarget; next?: TimetablePreviewTarget };
  onSelectNeighbor?: (t: TimetablePreviewTarget) => void;
  onOpenFullView?: (t: TimetablePreviewTarget) => void;
}) {
  if (!target) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-3 p-4 sm:max-w-xl">
        <DialogHeader className="space-y-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <DialogTitle className="text-base">{target.title}</DialogTitle>
              {target.subtitle ? (
                <p className="text-xs text-muted-foreground">{target.subtitle}</p>
              ) : null}
            </div>
            {onOpenFullView ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0 h-8 text-xs"
                onClick={() => onOpenFullView(target)}
              >
                <ExternalLink className="mr-1 size-3" />
                Tam görünüm
              </Button>
            ) : null}
          </div>
          {neighbors && (neighbors.prev || neighbors.next) ? (
            <div className="flex items-center justify-between gap-2 pt-1">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-7"
                disabled={!neighbors.prev}
                onClick={() => neighbors.prev && onSelectNeighbor?.(neighbors.prev)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-[10px] text-muted-foreground">Komşu kayıt</span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-7"
                disabled={!neighbors.next}
                onClick={() => neighbors.next && onSelectNeighbor?.(neighbors.next)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          ) : null}
        </DialogHeader>
        <TimetableMiniPreview
          title="Haftalık özet"
          entries={entries}
          workDays={workDays}
          maxLesson={maxLesson}
        />
      </DialogContent>
    </Dialog>
  );
}
