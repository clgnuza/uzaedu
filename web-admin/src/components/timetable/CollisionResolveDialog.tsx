'use client';

import {
  Dialog,
  DialogContent,
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Çakışma — ne yapalım?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          <strong>{moving.class_section} · {moving.subject}</strong> bu saatte{' '}
          {occupants.length} ders var.
        </p>
        <ul className="space-y-2">
          {occupants.map((o) => (
            <li key={o.id}>
              <Button type="button" variant="outline" className="h-auto w-full justify-start py-2 text-left text-xs" onClick={() => onSwapWith(o.id)}>
                Takas: {o.class_section} · {o.subject}
                {o.teacher_label ? ` (${o.teacher_label})` : ''}
              </Button>
            </li>
          ))}
        </ul>
        {onPlaceAnyway && (
          <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={onPlaceAnyway}>
            Uyarıyı yok say (önerilmez)
          </Button>
        )}
        <Button type="button" variant="secondary" size="sm" onClick={onClose}>
          İptal
        </Button>
      </DialogContent>
    </Dialog>
  );
}
