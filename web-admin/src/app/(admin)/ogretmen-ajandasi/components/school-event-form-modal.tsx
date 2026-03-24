'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api';
import { Loader2, Users, Check, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const BRANCH_COLORS = [
  { bg: 'bg-blue-500/15', border: 'border-blue-400/40', text: 'text-blue-700 dark:text-blue-300', chip: 'bg-blue-500/20 border-blue-400/30', chipSel: 'bg-blue-500/35 ring-1 ring-blue-400/50' },
  { bg: 'bg-emerald-500/15', border: 'border-emerald-400/40', text: 'text-emerald-700 dark:text-emerald-300', chip: 'bg-emerald-500/20 border-emerald-400/30', chipSel: 'bg-emerald-500/35 ring-1 ring-emerald-400/50' },
  { bg: 'bg-violet-500/15', border: 'border-violet-400/40', text: 'text-violet-700 dark:text-violet-300', chip: 'bg-violet-500/20 border-violet-400/30', chipSel: 'bg-violet-500/35 ring-1 ring-violet-400/50' },
  { bg: 'bg-amber-500/15', border: 'border-amber-400/40', text: 'text-amber-700 dark:text-amber-300', chip: 'bg-amber-500/20 border-amber-400/30', chipSel: 'bg-amber-500/35 ring-1 ring-amber-400/50' },
  { bg: 'bg-rose-500/15', border: 'border-rose-400/40', text: 'text-rose-700 dark:text-rose-300', chip: 'bg-rose-500/20 border-rose-400/30', chipSel: 'bg-rose-500/35 ring-1 ring-rose-400/50' },
  { bg: 'bg-cyan-500/15', border: 'border-cyan-400/40', text: 'text-cyan-700 dark:text-cyan-300', chip: 'bg-cyan-500/20 border-cyan-400/30', chipSel: 'bg-cyan-500/35 ring-1 ring-cyan-400/50' },
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
      <DialogContent title={isEdit ? 'Okul Etkinliğini Düzenle' : 'Okul Etkinliği Ekle'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Başlık *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Etkinlik başlığı"
              required
              className="mt-1 min-h-[44px]"
            />
          </div>
          <div>
            <Label>Açıklama</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-input bg-background px-4 py-3 min-h-[80px]"
            />
          </div>
          <div>
            <Label>Tarih ve Saat *</Label>
            <Input
              type="datetime-local"
              value={eventAt}
              onChange={(e) => setEventAt(e.target.value)}
              className="mt-1 min-h-[44px]"
            />
          </div>
          <div>
            <Label>Etkinlik türü</Label>
            <Input
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              placeholder="örn: Zümre toplantısı, Okul gezisi"
              className="mt-1 min-h-[44px]"
            />
          </div>
          <div>
            <Label className="flex items-center gap-2">
              <Users className="size-4 text-muted-foreground" />
              Bildirim alacak öğretmenler
            </Label>
            <p className="mt-1 text-xs text-muted-foreground">Etkinlik bildirimi alacak öğretmenleri seçin. Zümre başlığına tıklayarak tümünü seçebilirsiniz.</p>
            {!loadingTeachers && selectedTeacherIds.size > 0 && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-sm font-medium text-primary">
                <Check className="size-4" />
                {selectedTeacherIds.size} öğretmen seçildi
              </div>
            )}
            {loadingTeachers ? (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-muted/50 px-4 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Öğretmenler yükleniyor...
              </div>
            ) : (
              <div className="mt-3 max-h-52 overflow-y-auto space-y-3 pr-1">
                {branches.map((b, i) => {
                  const list = byBranch(b);
                  const allSel = list.every((t) => selectedTeacherIds.has(t.id));
                  const c = BRANCH_COLORS[i % BRANCH_COLORS.length];
                  return (
                    <div
                      key={b}
                      className={cn(
                        'rounded-xl border-l-4 p-3 transition-colors',
                        c.bg,
                        c.border,
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggleBranch(b)}
                        className={cn(
                          'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left font-semibold transition-all hover:opacity-90',
                          c.text,
                        )}
                      >
                        <span>{b}</span>
                        <span className="flex items-center gap-1.5 text-xs font-medium">
                          {list.length} öğretmen
                          {allSel && <Check className="size-4" strokeWidth={2.5} />}
                        </span>
                      </button>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {list.map((t) => {
                          const sel = selectedTeacherIds.has(t.id);
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => toggleTeacher(t.id)}
                              className={cn(
                                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all',
                                c.chip,
                                c.border,
                                sel && c.chipSel,
                              )}
                            >
                              {sel && <Check className="size-3.5 shrink-0" strokeWidth={2.5} />}
                              <User className="size-3.5 shrink-0 opacity-70" />
                              {t.display_name || t.id.slice(0, 8)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {teachers.filter((t) => !(t.teacher_branch ?? '').trim()).length > 0 && (
                  <div className="rounded-xl border-l-4 border-slate-400/40 bg-slate-500/10 p-3">
                    <span className="mb-2 block px-3 py-1.5 text-sm font-semibold text-slate-600 dark:text-slate-400">
                      Branşı tanımlanmamış
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {teachers
                        .filter((t) => !(t.teacher_branch ?? '').trim())
                        .map((t) => {
                          const sel = selectedTeacherIds.has(t.id);
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => toggleTeacher(t.id)}
                              className={cn(
                                'inline-flex items-center gap-1.5 rounded-full border border-slate-400/30 bg-slate-500/20 px-3 py-1.5 text-sm font-medium transition-all',
                                sel && 'bg-slate-500/35 ring-1 ring-slate-400/50',
                              )}
                            >
                              {sel && <Check className="size-3.5 shrink-0" strokeWidth={2.5} />}
                              <User className="size-3.5 shrink-0 opacity-70" />
                              {t.display_name || t.id.slice(0, 8)}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}
                {teachers.length === 0 && (
                  <p className="rounded-xl bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
                    Öğretmen bulunamadı.
                  </p>
                )}
              </div>
            )}
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={important} onChange={(e) => setImportant(e.target.checked)} className="rounded" />
            <span className="text-sm">Önemli</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
            <Button type="submit" disabled={loading || !title.trim()}>{isEdit ? 'Güncelle' : 'Kaydet'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
