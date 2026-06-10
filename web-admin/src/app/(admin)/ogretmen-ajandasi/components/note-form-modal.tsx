'use client';

import { useState, useEffect } from 'react';
import { BellRing, Layers, Palette, Pin, Tag } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ReminderFormSection } from './reminder-form-section';
import { FileUploadSection, type PendingFile } from './file-upload-section';
import {
  AGENDA_DIALOG_CLASS,
  AgendaClassPills,
  AgendaFormActions,
  agendaInput,
  agendaLabel,
  agendaSection,
  agendaTextarea,
} from './agenda-form-ui';

export type NoteFormData = {
  title: string;
  body: string;
  tags: string;
  subjectId?: string;
  classId?: string;
  color?: string;
  pinned?: boolean;
  remindAt?: string;
  attachments?: { url: string; fileType?: string; fileName?: string }[];
};

const COLORS = ['', '#fef3c7', '#d1fae5', '#dbeafe', '#fce7f3', '#e9d5ff'];

export function NoteFormModal({
  open,
  onOpenChange,
  onSubmit,
  initial,
  subjects = [],
  classes = [],
  onUploadFile,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: NoteFormData) => Promise<void>;
  initial?: Partial<Omit<NoteFormData, 'tags'> & { tags?: string | string[] }>;
  subjects?: { id: string; label: string }[];
  classes?: { id: string; label: string }[];
  onUploadFile?: (file: File) => Promise<{ publicUrl: string; fileType?: string; fileName?: string }>;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [tags, setTags] = useState(Array.isArray(initial?.tags) ? initial.tags.join(', ') : (initial?.tags ?? ''));
  const [subjectId, setSubjectId] = useState(initial?.subjectId ?? '');
  const [classId, setClassId] = useState(initial?.classId ?? '');
  const [color, setColor] = useState(initial?.color ?? '');
  const [pinned, setPinned] = useState(initial?.pinned ?? false);
  const [remindAt, setRemindAt] = useState<string | undefined>();
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(initial?.title ?? '');
      setBody(initial?.body ?? '');
      setTags(Array.isArray(initial?.tags) ? initial.tags.join(', ') : (initial?.tags ?? ''));
      setSubjectId(initial?.subjectId ?? '');
      setClassId(initial?.classId ?? '');
      setColor(initial?.color ?? '');
      setPinned(initial?.pinned ?? false);
      setRemindAt(undefined);
      setPendingFiles([]);
    }
  }, [open, initial]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    try {
      const attachments = pendingFiles
        .filter((pf) => pf.url && !pf.error)
        .map((pf) => ({ url: pf.url!, fileType: pf.fileType, fileName: pf.fileName }));
      await onSubmit({
        title: title.trim(),
        body: body.trim(),
        tags: tags.trim(),
        subjectId: subjectId || undefined,
        classId: classId || undefined,
        color: color || undefined,
        pinned,
        remindAt,
        attachments: attachments.length > 0 ? attachments : undefined,
      });
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={initial ? 'Notu Düzenle' : 'Yeni Not'} className={AGENDA_DIALOG_CLASS}>
        <form onSubmit={handleSubmit} className="space-y-2">
          <div>
            <span className={agendaLabel}>Başlık *</span>
            <Input
              id="note-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Not başlığı"
              required
              className={agendaInput}
            />
          </div>
          <div>
            <span className={agendaLabel}>Açıklama</span>
            <textarea
              id="note-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Opsiyonel açıklama…"
              rows={3}
              className={agendaTextarea}
            />
          </div>
          <div className={agendaSection}>
            <span className={cn(agendaLabel, 'inline-flex items-center gap-1')}>
              <Tag className="size-3 text-fuchsia-500" aria-hidden />
              Etiketler
            </span>
            <Input
              id="note-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Virgülle ayırın"
              className={cn(agendaInput, 'mt-1')}
            />
          </div>

          {subjects.length > 0 && (
            <div className={agendaSection}>
              <span className={cn(agendaLabel, 'inline-flex items-center gap-1')}>
                <Layers className="size-3 text-sky-500" aria-hidden />
                Ders
              </span>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className={cn(agendaInput, 'mt-1 w-full')}
              >
                <option value="">Seçin</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <AgendaClassPills classes={classes} value={classId} onChange={setClassId} label="İlgili sınıf" emptyLabel="Genel" />

          <div className={agendaSection}>
            <span className={cn(agendaLabel, 'inline-flex items-center gap-1')}>
              <Palette className="size-3 text-amber-500" aria-hidden />
              Renk
            </span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c || 'none'}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    'size-7 rounded-full border-2 transition-all',
                    color === c ? 'border-foreground ring-2 ring-primary/20 ring-offset-1 ring-offset-background' : 'border-transparent',
                  )}
                  style={c ? { backgroundColor: c } : { backgroundColor: 'var(--muted)' }}
                  aria-label={c ? 'Renk seç' : 'Renksiz'}
                />
              ))}
            </div>
            <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-md border border-border/50 bg-background/60 px-2 py-1.5">
              <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="rounded" />
              <Pin className="size-3 text-muted-foreground" aria-hidden />
              <span className="text-[11px] font-medium text-foreground">Üste sabitle</span>
            </label>
          </div>

          {!initial && (
            <details className={cn(agendaSection, 'group open:pb-1.5')}>
              <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[11px] font-semibold text-foreground [&::-webkit-details-marker]:hidden">
                <BellRing className="size-3.5 text-teal-500" aria-hidden />
                Hatırlatıcı
              </summary>
              <div className="mt-1.5">
                <ReminderFormSection remindAt={remindAt} onChange={setRemindAt} disabled={loading} showLeadingBell={false} />
              </div>
            </details>
          )}

          {onUploadFile && !initial && (
            <div className={agendaSection}>
              <span className={agendaLabel}>Ekler</span>
              <div className="mt-1">
                <FileUploadSection
                  files={pendingFiles}
                  onFilesChange={setPendingFiles}
                  onUpload={onUploadFile}
                  disabled={loading}
                  maxFiles={5}
                />
              </div>
            </div>
          )}

          <AgendaFormActions
            onCancel={() => onOpenChange(false)}
            loading={loading}
            submitLabel="Kaydet"
            disabled={!title.trim()}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
