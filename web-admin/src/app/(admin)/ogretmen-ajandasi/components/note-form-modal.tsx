'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { ReminderFormSection } from './reminder-form-section';
import { FileUploadSection, type PendingFile } from './file-upload-section';

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
  const [loading, setLoading] = useState(false);

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
      setTitle('');
      setBody('');
      setTags('');
      setPendingFiles([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={initial ? 'Notu Düzenle' : 'Yeni Not'}>
        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          <div>
            <Label htmlFor="note-title" className="text-xs sm:text-sm">
              Başlık
            </Label>
            <Input
              id="note-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Not başlığı"
              required
              className="mt-1 min-h-10 text-sm sm:min-h-11"
            />
          </div>
          <div>
            <Label htmlFor="note-body" className="text-xs sm:text-sm">
              Açıklama
            </Label>
            <textarea
              id="note-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Açıklama (opsiyonel)"
              rows={3}
              className="mt-1 min-h-[88px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm sm:min-h-[100px] sm:px-3 sm:py-2.5"
            />
          </div>
          <div>
            <Label htmlFor="note-tags" className="text-xs sm:text-sm">
              Etiketler
            </Label>
            <Input
              id="note-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Virgülle ayırın"
              className="mt-1 min-h-10 text-sm sm:min-h-11"
            />
          </div>
          {(subjects.length > 0 || classes.length > 0) && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              {subjects.length > 0 && (
                <div>
                  <Label className="text-xs sm:text-sm">Ders</Label>
                  <select
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    className="mt-1 min-h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm sm:min-h-11"
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
              {classes.length > 0 && (
                <div>
                  <Label className="text-xs sm:text-sm">Sınıf</Label>
                  <select
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                    className="mt-1 min-h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm sm:min-h-11"
                  >
                    <option value="">Seçin</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <div className="min-w-0">
              <Label className="text-[11px] sm:text-xs">Renk</Label>
              <div className="mt-1 flex flex-wrap gap-1.5 sm:gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c || 'none'}
                    type="button"
                    onClick={() => setColor(c)}
                    className={cn(
                      'size-7 rounded-full border-2 transition-all sm:size-8',
                      color === c ? 'border-foreground ring-2 ring-offset-1 ring-offset-background sm:ring-offset-2' : 'border-transparent',
                    )}
                    style={c ? { backgroundColor: c } : { backgroundColor: 'var(--muted)' }}
                  />
                ))}
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="rounded" />
              <span className="text-xs sm:text-sm">Sabitle</span>
            </label>
          </div>
          {!initial && (
            <ReminderFormSection remindAt={remindAt} onChange={setRemindAt} disabled={loading} />
          )}
          {onUploadFile && !initial && (
            <div>
              <Label className="text-[11px] text-muted-foreground sm:text-xs">Ekler</Label>
              <FileUploadSection
                files={pendingFiles}
                onFilesChange={setPendingFiles}
                onUpload={onUploadFile}
                disabled={loading}
                maxFiles={5}
              />
            </div>
          )}
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end sm:pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="h-10 w-full rounded-xl sm:h-11 sm:w-auto">
              İptal
            </Button>
            <Button type="submit" disabled={loading || !title.trim()} className="h-10 w-full rounded-xl sm:h-11 sm:w-auto">
              {loading ? 'Kaydediliyor…' : 'Kaydet'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
