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

export function CollisionResolveDialog({
  open,
  moving,
  occupants,
  onClose,
  onSwapWith,
  onPlaceAnyway,
}: {
  open: boolean;
  moving: EditorEntry | null;
  occupants: EditorEntry[];
  onClose: () => void;
  onSwapWith: (targetId: string) => void;
  onPlaceAnyway?: () => void;
}) {
  if (!moving) return null;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border/60 bg-destructive/5 px-5 py-4 text-left">
          <DialogTitle className="text-base">Çakışma — ne yapalım?</DialogTitle>
          <DialogDescription className="text-left text-sm">
            <strong className="text-foreground">
              {moving.class_section} · {moving.subject}
            </strong>{' '}
            bu saatte {occupants.length} ders var.
          </DialogDescription>
        </DialogHeader>
        <ul className="max-h-[40vh] space-y-2 overflow-y-auto px-5 py-4">
          {occupants.map((o) => (
            <li key={o.id}>
              <Button
                type="button"
                variant="outline"
                className="h-auto w-full justify-start rounded-lg border-border/70 py-2.5 text-left text-xs"
                onClick={() => onSwapWith(o.id)}
              >
                Takas: {o.class_section} · {o.subject}
                {o.teacher_label ? ` (${o.teacher_label})` : ''}
              </Button>
            </li>
          ))}
        </ul>
        <DialogFooter className="flex-col gap-2 border-t border-border/60 bg-muted/20 px-4 py-3 sm:flex-col sm:justify-stretch">
          {onPlaceAnyway && (
            <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={onPlaceAnyway}>
              Uyarıyı yok say (önerilmez)
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
