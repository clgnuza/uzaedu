'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { agendaInput, agendaLabel, agendaSection } from './agenda-form-ui';

export type AgendaStudentOption = { id: string; name: string; classId?: string };

function studentInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toLocaleUpperCase('tr-TR');
  return name.slice(0, 2).toLocaleUpperCase('tr-TR');
}

export function AgendaStudentPicker({
  students,
  classes,
  value,
  onChange,
  required,
  optional,
}: {
  students: AgendaStudentOption[];
  classes: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  required?: boolean;
  optional?: boolean;
}) {
  const [classFilter, setClassFilter] = useState('');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    let list = students;
    if (classFilter) list = list.filter((s) => s.classId === classFilter);
    const q = query.trim().toLocaleLowerCase('tr-TR');
    if (q) list = list.filter((s) => s.name.toLocaleLowerCase('tr-TR').includes(q));
    const seen = new Set<string>();
    return list.filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
  }, [students, classFilter, query]);

  useEffect(() => {
    if (!value || !classFilter) return;
    const inClass = students.some((s) => s.id === value && s.classId === classFilter);
    if (!inClass) onChange('');
  }, [classFilter, value, students, onChange]);

  return (
    <div className={cn(agendaSection, 'space-y-2 !py-2')}>
      <div className="flex items-center justify-between gap-2 px-0.5">
        <span className={agendaLabel}>
          Öğrenci{required ? ' *' : optional ? ' (opsiyonel)' : ''}
        </span>
        <span className="text-[10px] font-medium tabular-nums text-muted-foreground">{filtered.length} kişi</span>
      </div>

      {classes.length > 0 && (
        <div className="flex gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => setClassFilter('')}
            className={cn(
              'shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors',
              !classFilter
                ? 'border-violet-500/40 bg-violet-500/15 text-violet-900 dark:text-violet-100'
                : 'border-border/70 bg-background/80 text-muted-foreground hover:bg-muted/50',
            )}
          >
            Tümü
          </button>
          {classes.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setClassFilter(c.id)}
              className={cn(
                'shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors',
                classFilter === c.id
                  ? 'border-violet-500/40 bg-violet-500/15 text-violet-900 dark:text-violet-100'
                  : 'border-border/70 bg-background/80 text-muted-foreground hover:bg-muted/50',
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="İsimle ara…"
          autoComplete="off"
          className={cn(agendaInput, 'w-full pl-8')}
        />
      </div>

      <div className="max-h-40 overflow-y-auto overscroll-contain rounded-lg border border-border/60 bg-background/90 p-1 shadow-inner">
        {optional && value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="mb-1 w-full rounded-md border border-dashed border-border/70 py-1 text-[10px] font-medium text-muted-foreground hover:bg-muted/40"
          >
            Öğrenci seçimini kaldır
          </button>
        )}
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-[11px] text-muted-foreground">
            {students.length === 0 ? 'Kayıtlı öğrenci yok' : 'Eşleşen öğrenci yok'}
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-0.5 sm:grid-cols-2">
            {filtered.map((s) => {
              const selected = value === s.id;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onChange(selected && optional ? '' : s.id)}
                    className={cn(
                      'flex w-full min-w-0 items-center gap-2 rounded-md border px-2 py-1.5 text-left text-[11px] font-medium transition-all',
                      selected
                        ? 'border-violet-500/50 bg-violet-500/12 text-foreground ring-1 ring-violet-500/25'
                        : 'border-transparent text-foreground/90 hover:border-border/60 hover:bg-muted/40',
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                        selected
                          ? 'bg-violet-600 text-white'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {selected ? <Check className="size-3.5" strokeWidth={2.5} /> : studentInitials(s.name)}
                    </span>
                    <span className="min-w-0 flex-1 truncate leading-tight">{s.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
