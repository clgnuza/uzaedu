'use client';

import { useMemo } from 'react';
import { ddVariantAt, type CardPastelVariant } from '@/components/ders-dagit/dd-ui';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import type { TeacherConfig } from '@/components/ders-dagit/teacher-config-types';
import { cn } from '@/lib/utils';

const SOFT_CLASS: Record<CardPastelVariant, string> = {
  indigo: 'card-pastel-soft-indigo',
  violet: 'card-pastel-soft-violet',
  teal: 'card-pastel-soft-teal',
  sky: 'card-pastel-soft-sky',
  lavender: 'card-pastel-soft-lavender',
  mint: 'card-pastel-soft-mint',
  rose: 'card-pastel-soft-rose',
  amber: 'card-pastel-soft-amber',
  peach: 'card-pastel-soft-peach',
  default: '',
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return (parts[0]?.[0] ?? '?').toUpperCase();
}

type Props = {
  teachers: TeacherConfig[];
  colorIndex: Map<string, number>;
  activeId: string | null;
  bulkIds: Set<string>;
  dirtyIds: Set<string>;
  query: string;
  onQueryChange: (q: string) => void;
  onActive: (id: string) => void;
  onToggleBulk: (id: string) => void;
  onSelectAll: () => void;
  onClearBulk: () => void;
};

export function TeacherPickerList({
  teachers,
  colorIndex,
  activeId,
  bulkIds,
  dirtyIds,
  query,
  onQueryChange,
  onActive,
  onToggleBulk,
  onSelectAll,
  onClearBulk,
}: Props) {
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    if (!q) return teachers;
    return teachers.filter((t) => {
      const n = (t.display_name ?? '').toLocaleLowerCase('tr');
      const b = (t.branch ?? '').toLocaleLowerCase('tr');
      return n.includes(q) || b.includes(q);
    });
  }, [teachers, query]);

  return (
    <nav
      aria-label="Öğretmen listesi"
      className="flex max-h-[min(50vh,28rem)] flex-col gap-3 rounded-xl border bg-card p-3 shadow-sm lg:max-h-none lg:h-full lg:min-h-[12rem]"
    >
      <div>
        <Label htmlFor="dd-teacher-search" className="text-sm">
          Öğretmen ara
        </Label>
        <Input
          id="dd-teacher-search"
          type="search"
          className="mt-1"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Ad veya branş"
          autoComplete="off"
        />
      </div>

      <div className="flex flex-wrap gap-1">
        <Button type="button" size="sm" variant="outline" onClick={onSelectAll}>
          Tümünü seç
        </Button>
        {bulkIds.size > 0 && (
          <Button type="button" size="sm" variant="ghost" onClick={onClearBulk}>
            Seçimi temizle ({bulkIds.size})
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground" aria-live="polite">
        {filtered.length} öğretmen · {bulkIds.size} toplu seçili
      </p>

      <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-0.5" role="listbox" aria-label="Öğretmenler">
        {filtered.map((t) => {
          const idx = colorIndex.get(t.id) ?? 0;
          const variant = ddVariantAt(idx);
          const soft = SOFT_CLASS[variant];
          const title = t.display_name ?? t.user_id.slice(0, 8);
          const isActive = activeId === t.id;
          const inBulk = bulkIds.has(t.id);
          const dirty = dirtyIds.has(t.id);

          return (
            <li key={t.id} role="presentation">
              <div
                className={cn(
                  'flex items-stretch gap-1 rounded-lg border transition-shadow',
                  isActive && 'ring-2 ring-primary shadow-md',
                  soft,
                )}
              >
                <input
                  type="checkbox"
                  className="mt-3.5 ml-2 size-4 shrink-0 accent-primary"
                  checked={inBulk}
                  onChange={() => onToggleBulk(t.id)}
                  aria-label={`${title} toplu düzenlemeye ekle`}
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  onClick={() => onActive(t.id)}
                >
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary"
                    aria-hidden
                  >
                    {initials(title)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium leading-tight">{title}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{t.branch || 'Branş yok'}</span>
                  </span>
                  {dirty && (
                    <span
                      className="shrink-0 rounded bg-amber-200 px-1.5 py-0.5 text-[9px] font-semibold text-amber-950 dark:bg-amber-900 dark:text-amber-100"
                      title="Kaydedilmedi"
                    >
                      *
                    </span>
                  )}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
