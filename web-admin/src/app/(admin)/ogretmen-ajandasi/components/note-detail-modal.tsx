'use client';

import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Archive, Trash2, Pencil, ExternalLink, FileText } from 'lucide-react';
import { NoteFormModal } from './note-form-modal';

type AgendaNote = {
  id: string;
  title: string;
  body?: string | null;
  tags?: string[] | null;
  color?: string | null;
  pinned?: boolean;
  attachments?: { id: string; fileUrl: string; fileName?: string | null; fileType?: string | null }[];
};

export function NoteDetailModal({
  note,
  open,
  onOpenChange,
  onArchive,
  onDelete,
  onUpdate,
  onDeleteAttachment,
  subjects = [],
  classes = [],
}: {
  note: AgendaNote | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onArchive: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onUpdate: (id: string, data: { title: string; body?: string; tags?: string[] }) => Promise<void>;
  onDeleteAttachment?: (noteId: string, attachmentId: string) => Promise<void>;
  subjects?: { id: string; label: string }[];
  classes?: { id: string; label: string }[];
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!note) return null;

  const handleArchive = async () => {
    setLoading(true);
    try {
      await onArchive(note.id);
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Bu notu silmek istediğinize emin misiniz?')) return;
    setLoading(true);
    try {
      await onDelete(note.id);
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const atts = note.attachments ?? [];
  const isImage = (t?: string | null) => t?.startsWith('image/');

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent title={note.title} className="max-w-lg">
          <div className="space-y-5">
            {note.body && (
              <div className="rounded-xl bg-muted/30 p-4 text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed border border-border/50">
                {note.body}
              </div>
            )}
            {note.tags && note.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {note.tags.map((t) => (
                  <span key={t} className="rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium">
                    {t}
                  </span>
                ))}
              </div>
            )}
            {atts.length > 0 && (
              <div className="space-y-3">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ekler</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {atts.map((a) => (
                    <a
                      key={a.id}
                      href={a.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex flex-col rounded-xl border bg-card p-3 transition-all hover:bg-muted/50 hover:shadow-md hover:border-primary/30"
                    >
                      {isImage(a.fileType) ? (
                        <div className="size-14 rounded-lg bg-muted overflow-hidden shrink-0 mb-2">
                          <img src={a.fileUrl} alt="" className="size-full object-cover" />
                        </div>
                      ) : (
                        <div className="size-14 rounded-lg bg-primary/10 flex items-center justify-center mb-2 shrink-0">
                          <FileText className="size-7 text-primary" />
                        </div>
                      )}
                      <span className="truncate text-xs font-medium flex-1">{a.fileName ?? 'Dosya'}</span>
                      <ExternalLink className="size-3.5 text-muted-foreground mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-5 border-t border-border/60">
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} disabled={loading} className="rounded-xl">
                <Pencil className="size-4 mr-1" />
                Düzenle
              </Button>
              <Button variant="outline" size="sm" onClick={handleArchive} disabled={loading} className="rounded-xl">
                <Archive className="size-4 mr-1" />
                Arşivle
              </Button>
              <Button variant="outline" size="sm" onClick={handleDelete} disabled={loading} className="rounded-xl text-destructive hover:text-destructive">
                <Trash2 className="size-4 mr-1" />
                Sil
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <NoteFormModal
        open={editOpen}
        onOpenChange={setEditOpen}
        onSubmit={async (data) => {
          await onUpdate(note.id, {
            title: data.title,
            body: data.body || undefined,
            tags: data.tags ? data.tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
          });
          setEditOpen(false);
        }}
        initial={{
          title: note.title,
          body: note.body ?? undefined,
          tags: (Array.isArray(note.tags) ? note.tags.join(', ') : note.tags) ?? '',
          subjectId: (note as { subjectId?: string }).subjectId,
          classId: (note as { classId?: string }).classId,
        }}
        subjects={subjects}
        classes={classes}
      />
    </>
  );
}
