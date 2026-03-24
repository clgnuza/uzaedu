'use client';

import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';

export type StudentNoteDetail = {
  id: string;
  noteType: string;
  noteDate: string;
  description?: string | null;
  tags?: string[] | null;
  student?: { id: string; name: string };
  subject?: { id: string; label: string } | null;
};

export function StudentNoteDetailModal({
  note,
  loading,
  open,
  onOpenChange,
}: {
  note: StudentNoteDetail | null;
  loading: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {

  const typeLabel = note?.noteType === 'positive' ? 'Olumlu' : note?.noteType === 'negative' ? 'Olumsuz' : 'Gözlem';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={note ? `${note.student?.name ?? 'Öğrenci'} – ${typeLabel}` : 'Öğrenci Notu'} className="max-w-lg">
        {loading ? (
          <Skeleton className="h-32 w-full rounded-xl" />
        ) : note ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-full bg-primary/10 text-primary px-3 py-1 font-medium">{typeLabel}</span>
              <span className="text-muted-foreground">{note.noteDate}</span>
              {note.subject && (
                <span className="rounded-full bg-muted px-3 py-1">{note.subject.label}</span>
              )}
            </div>
            {note.description && (
              <div className="rounded-xl bg-muted/30 p-4 text-sm whitespace-pre-wrap border border-border/50">
                {note.description}
              </div>
            )}
            {note.tags && note.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {note.tags.map((t) => (
                  <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
