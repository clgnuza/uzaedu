'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { EditorEntry } from '@/lib/ders-dagit-timetable-api';
import { weekdayShort } from '@/lib/studio-timetable-ui';

function entryLine(o: EditorEntry, day: number, lesson: number): string {
  const subj = o.subject?.trim() || 'Ders';
  const cls = o.class_section?.trim() || '—';
  return `${subj} (${cls}) — ${weekdayShort(day)}:${lesson}`;
}

export function CollisionResolveDialog({
  open,
  moving,
  day,
  lesson,
  occupants,
  allowIgnoreClash,
  onClose,
  onClearConflictsAndPlace,
  onSwapWith,
  onPlaceAnyway,
}: {
  open: boolean;
  moving: EditorEntry | null;
  day: number;
  lesson: number;
  occupants: EditorEntry[];
  allowIgnoreClash?: boolean;
  onClose: () => void;
  onClearConflictsAndPlace: () => void;
  onSwapWith?: (targetId: string) => void;
  onPlaceAnyway?: () => void;
}) {
  if (!moving) return null;
  const locked = occupants.some((o) => o.is_locked);
  const singleSwap = occupants.length === 1 && onSwapWith && !occupants[0]!.is_locked;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="border-b border-sky-200/80 bg-sky-50 px-5 py-3 text-left dark:border-sky-900/50 dark:bg-sky-950/40">
          <DialogTitle className="text-base">Çakışanlar bulundu</DialogTitle>
          <DialogDescription className="text-left text-sm">
            <strong className="text-foreground">{entryLine(moving, day, lesson)}</strong> bu saate yerleştirilemiyor.
          </DialogDescription>
        </DialogHeader>
        <ul className="max-h-[40vh] space-y-1.5 overflow-y-auto px-5 py-4">
          {occupants.map((o) => (
            <li
              key={o.id}
              className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-foreground"
            >
              {entryLine(o, day, lesson)}
              {o.is_locked ? ' · kilitli' : ''}
            </li>
          ))}
        </ul>
        <DialogFooter className="flex-col gap-2 border-t border-border/60 bg-muted/10 px-4 py-3 sm:flex-col sm:justify-stretch">
          <Button
            type="button"
            className="w-full bg-amber-400 text-amber-950 hover:bg-amber-300"
            disabled={locked}
            onClick={onClearConflictsAndPlace}
          >
            Çakışanları sil ve kartı yerleştir
          </Button>
          {singleSwap && (
            <Button
              type="button"
              variant="outline"
              className="w-full text-xs"
              onClick={() => onSwapWith(occupants[0]!.id)}
            >
              Takas: {occupants[0]!.class_section} · {occupants[0]!.subject}
            </Button>
          )}
          {allowIgnoreClash && onPlaceAnyway && (
            <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={onPlaceAnyway}>
              Çelişkileri dikkate alma, kartı yerleştir
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" className="w-full" onClick={onClose}>
            İptal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
