'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api';
import { Loader2, Users, Check, User, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AGENDA_DIALOG_CLASS,
  AgendaFormActions,
  agendaInput,
  agendaLabel,
  agendaSection,
  agendaTextarea,
} from './agenda-form-ui';

const BRANCH_COLORS = [
  { bg: 'bg-blue-500/12', border: 'border-blue-400/35', text: 'text-blue-700 dark:text-blue-300', chip: 'bg-blue-500/15 border-blue-400/25', chipSel: 'bg-blue-500/30 ring-1 ring-blue-400/40' },
  { bg: 'bg-emerald-500/12', border: 'border-emerald-400/35', text: 'text-emerald-700 dark:text-emerald-300', chip: 'bg-emerald-500/15 border-emerald-400/25', chipSel: 'bg-emerald-500/30 ring-1 ring-emerald-400/40' },
  { bg: 'bg-violet-500/12', border: 'border-violet-400/35', text: 'text-violet-700 dark:text-violet-300', chip: 'bg-violet-500/15 border-violet-400/25', chipSel: 'bg-violet-500/30 ring-1 ring-violet-400/40' },
  { bg: 'bg-amber-500/12', border: 'border-amber-400/35', text: 'text-amber-700 dark:text-amber-300', chip: 'bg-amber-500/15 border-amber-400/25', chipSel: 'bg-amber-500/30 ring-1 ring-amber-400/40' },
];

type Teacher = { id: string; display_name: string; teacher_branch?: string | null };
type SchoolEventFormData = {
  title: string;
  description?: string;
  eventAt: string;
  eventType?: string;
  targetTeacherIds?: string[];
  important?: boolean;
};

type SchoolEventEdit = {
  id: string;
  title: string;
  description?: string | null;
  eventAt: string;
  eventType?: string | null;
  important?: boolean;
  assignments?: { userId: string }[];
};

export function SchoolEventFormModal({
  open,
  onOpenChange,
  onSubmit,
  token,
  eventId,
  initialData,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: SchoolEventFormData & { id?: string }) => Promise<void>;
  token: string | null;
  eventId?: string | null;
  initialData?: SchoolEventEdit | null;
}) {
  const isEdit = Boolean(eventId);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventAt, setEventAt] = useState(new Date().toISOString().slice(0, 16));
  const [eventType, setEventType] = useState('');
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<Set<string>>(new Set());
  const [important, setImportant] = useState(false);
  const [loading, setLoading] = useState(false);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(false);

  useEffect(() => {
    if (!open || !token) return;
    setLoadingTeachers(true);
    apiFetch<Teacher[]>('/duty/teachers?includeExempt=true', { token })
      .then((list) => setTeachers(Array.isArray(list) ? list : []))
      .catch(() => setTeachers([]))
      .finally(() => setLoadingTeachers(false));
  }, [open, token]);

  useEffect(() => {
    if (open && initialData) {
      setTitle(initialData.title);
      setDescription(initialData.description ?? '');
      setEventAt((typeof initialData.eventAt === 'string' ? initialData.eventAt : new Date(initialData.eventAt).toISOString()).slice(0, 16));
      setEventType(initialData.eventType ?? '');
      setImportant(initialData.important ?? false);
      setSelectedTeacherIds(new Set((initialData.assignments ?? []).map((a) => a.userId).filter(Boolean)));
    } else if (!open) {
      setTitle('');
      setDescription('');
      setEventAt(new Date().toISOString().slice(0, 16));
      setEventType('');
      setSelectedTeacherIds(new Set());
      setImportant(false);
    }
  }, [open, initialData]);

  const branchSet = new Set<string>();
  teachers.forEach((t) => {
    const b = (t.teacher_branch ?? '').trim();
    if (b) branchSet.add(b);
  });
  const branches = [...branchSet].sort();
  const byBranch = (b: string) => teachers.filter((t) => (t.teacher_branch ?? '').trim() === b);

  const toggleTeacher = (id: string) => {
    setSelectedTeacherIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleBranch = (branch: string) => {
    const ids = byBranch(branch).map((t) => t.id);
    const allSel = ids.every((id) => selectedTeacherIds.has(id));
    setSelectedTeacherIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (allSel ? next.delete(id) : next.add(id)));
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    try {
      const teacherIds = Array.from(selectedTeacherIds);
      await onSubmit({
        title: title.trim(),
        description: description.trim() || undefined,
        eventAt: new Date(eventAt).toISOString(),
        eventType: eventType.trim() || undefined,
        targetTeacherIds: teacherIds.length > 0 ? teacherIds : undefined,
        important,
        ...(isEdit && eventId ? { id: eventId } : {}),
      });
      onOpenChange(false);
      setTitle('');
      setDescription('');
      setEventAt(new Date().toISOString().slice(0, 16));
      setEventType('');
      setSelectedTeacherIds(new Set());
      setImportant(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={isEdit ? 'Okul Etkinliğini Düzenle' : 'Okul Etkinliği Ekle'}
        className={AGENDA_DIALOG_CLASS}
      >
        <form onSubmit={handleSubmit} className="space-y-2">
          <div>
            <span className={agendaLabel}>Başlık *</span>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Etkinlik başlığı"
              required
              className={agendaInput}
            />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <span className={agendaLabel}>Tarih ve saat *</span>
              <Input
                type="datetime-local"
                value={eventAt}
                onChange={(e) => setEventAt(e.target.value)}
                className={agendaInput}
              />
            </div>
            <div>
              <span className={agendaLabel}>Tür</span>
              <Input
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                placeholder="Zümre, gezi…"
                className={agendaInput}
              />
            </div>
          </div>
          <div>
            <span className={agendaLabel}>Açıklama</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Kısa not (opsiyonel)"
              className={agendaTextarea}
            />
          </div>

          <details className={cn(agendaSection, 'group open:pb-2')} open={selectedTeacherIds.size > 0 || teachers.length > 0}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[11px] font-semibold text-foreground [&::-webkit-details-marker]:hidden">
              <span className="inline-flex items-center gap-1.5">
                <Users className="size-3.5 text-indigo-500" aria-hidden />
                Bildirim alacak öğretmenler
              </span>
              {selectedTeacherIds.size > 0 && (
                <span className="rounded-full bg-primary/12 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                  {selectedTeacherIds.size}
                </span>
              )}
            </summary>
            <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
              Zümre başlığına tıklayarak tümünü seçin.
            </p>
            {loadingTeachers ? (
              <div className="mt-1.5 flex items-center gap-1.5 rounded-md bg-muted/40 px-2 py-2 text-[10px] text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                Yükleniyor…
              </div>
            ) : teachers.length === 0 ? (
              <p className="mt-1.5 rounded-md bg-muted/30 px-2 py-3 text-center text-[10px] text-muted-foreground">
                Öğretmen bulunamadı.
              </p>
            ) : (
              <div className="mt-1.5 max-h-28 space-y-1.5 overflow-y-auto pr-0.5">
                {branches.map((b, i) => {
                  const list = byBranch(b);
                  const allSel = list.every((t) => selectedTeacherIds.has(t.id));
                  const c = BRANCH_COLORS[i % BRANCH_COLORS.length]!;
                  return (
                    <div key={b} className={cn('rounded-md border-l-2 p-1.5', c.bg, c.border)}>
                      <button
                        type="button"
                        onClick={() => toggleBranch(b)}
                        className={cn('flex w-full items-center justify-between gap-1 px-1 text-left text-[11px] font-semibold', c.text)}
                      >
                        <span className="truncate">{b}</span>
                        <span className="flex shrink-0 items-center gap-0.5 text-[9px]">
                          {list.length}
                          {allSel && <Check className="size-3" strokeWidth={2.5} />}
                        </span>
                      </button>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {list.map((t) => {
                          const sel = selectedTeacherIds.has(t.id);
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => toggleTeacher(t.id)}
                              className={cn(
                                'inline-flex max-w-full items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-medium',
                                c.chip,
                                c.border,
                                sel && c.chipSel,
                              )}
                            >
                              {sel && <Check className="size-2.5 shrink-0" strokeWidth={2.5} />}
                              <User className="size-2.5 shrink-0 opacity-70" />
                              <span className="max-w-28 truncate">{t.display_name || t.id.slice(0, 8)}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </details>

          <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-foreground">
            <input
              type="checkbox"
              checked={important}
              onChange={(e) => setImportant(e.target.checked)}
              className="size-3.5 rounded border-input"
            />
            <Star className="size-3 text-amber-500" aria-hidden />
            Önemli
          </label>

          <AgendaFormActions
            onCancel={() => onOpenChange(false)}
            loading={loading}
            submitLabel={isEdit ? 'Güncelle' : 'Kaydet'}
            disabled={!title.trim()}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
