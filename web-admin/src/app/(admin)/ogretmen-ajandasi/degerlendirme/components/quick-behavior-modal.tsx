'use client';

import { useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { StudentMascotIcon } from '../lib/student-mascot-icon';

type SvgIcon = ComponentType<{ className?: string }>;

export type QuickBehaviorPreset = {
  name: string;
  Icon: SvgIcon;
  polarity: 'positive' | 'negative';
};

type Student = { id: string; name: string };

export function QuickBehaviorModal({
  preset,
  students,
  noteDate,
  token,
  onClose,
  onApplied,
}: {
  preset: QuickBehaviorPreset | null;
  students: Student[];
  noteDate: string;
  token: string | null;
  onClose: () => void;
  onApplied: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!preset) return;
    setSelected(new Set(students.map((s) => s.id)));
  }, [preset, students]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(students.map((s) => s.id)));
  const selectNone = () => setSelected(new Set());

  const submit = async (kind: 'positive' | 'negative') => {
    if (!token || !preset || selected.size === 0) return;
    setLoading(true);
    const description = `Şablon: ${preset.name}`;
    try {
      for (const id of selected) {
        await apiFetch('/teacher-agenda/student-notes', {
          method: 'POST',
          token,
          body: JSON.stringify({
            studentId: id,
            noteType: kind,
            noteDate,
            description,
          }),
        });
      }
      toast.success(`${selected.size} öğrenciye ${kind === 'positive' ? 'olumlu' : 'olumsuz'} not eklendi`);
      onApplied();
      onClose();
    } catch {
      toast.error('Kaydedilemedi');
    } finally {
      setLoading(false);
    }
  };

  if (!preset) return null;

  const Icon = preset.Icon;

  return (
    <div className="fixed inset-0 z-60 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="max-h-[min(90dvh,92vh)] w-full max-w-lg overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl sm:max-h-[85vh] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-muted ring-1 ring-black/5 dark:ring-white/10">
              <Icon className="size-9" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-bold leading-tight sm:text-base">Hızlı geri bildirim</h2>
              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-3">{preset.name}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground/90">
                {preset.polarity === 'positive' ? 'Olumlu şablon — isterseniz olumsuz da verebilirsiniz.' : 'Geliştirme şablonu — isterseniz olumlu da verebilirsiniz.'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-muted" aria-label="Kapat">
            <X className="size-5" />
          </button>
        </div>

        {students.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">Öğrenci yok. Üstten liste seçin.</div>
        ) : (
          <>
            <div className="flex gap-2 border-b border-border/80 px-4 py-2 sm:px-5">
              <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg text-xs" onClick={selectAll}>
                Tümünü seç
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-8 rounded-lg text-xs" onClick={selectNone}>
                Temizle
              </Button>
            </div>
            <div className="max-h-[min(38vh,320px)] overflow-y-auto overscroll-y-contain px-3 py-2 sm:max-h-[min(42vh,380px)] sm:px-4">
              <ul className="space-y-1">
                {students.map((s) => {
                  const on = selected.has(s.id);
                  return (
                    <li key={s.id}>
                      <label
                        className={cn(
                          'flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors',
                          on ? 'border-primary/40 bg-primary/5' : 'border-transparent hover:bg-muted/60',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggle(s.id)}
                          className="size-4 shrink-0 rounded border-input"
                        />
                        <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-black/5 dark:bg-zinc-800 dark:ring-white/10">
                          <StudentMascotIcon studentId={s.id} className="size-9" />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.name}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="flex flex-col gap-2 border-t border-border/80 bg-muted/20 px-4 py-3 sm:flex-row sm:px-5">
              <Button
                type="button"
                className="h-11 flex-1 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
                disabled={loading || selected.size === 0 || !token}
                onClick={() => void submit('positive')}
              >
                Olumlu ver ({selected.size})
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="h-11 flex-1 rounded-xl"
                disabled={loading || selected.size === 0 || !token}
                onClick={() => void submit('negative')}
              >
                Olumsuz ver ({selected.size})
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
