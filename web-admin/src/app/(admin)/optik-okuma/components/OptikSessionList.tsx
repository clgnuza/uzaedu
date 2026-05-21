'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { OptikScanSession } from '@/lib/optik-scan-sessions';
import { History, ListChecks, PenLine, Trash2 } from 'lucide-react';

export function OptikSessionList({
  sessions,
  activeId,
  onRestore,
  onDelete,
}: {
  sessions: OptikScanSession[];
  activeId: string | null;
  onRestore: (s: OptikScanSession) => void;
  onDelete: (id: string) => void;
}) {
  if (sessions.length === 0) return null;

  return (
    <section className="rounded-2xl border bg-card/80 p-3 shadow-sm">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <History className="size-4 text-muted-foreground" />
        Son oturumlar
        <span className="text-[10px] font-normal text-muted-foreground">(cihazda)</span>
      </h2>
      <ul className="space-y-1.5">
        {sessions.slice(0, 10).map((s) => {
          const active = s.id === activeId;
          const Icon = s.kind === 'mc' ? ListChecks : PenLine;
          return (
            <li
              key={s.id}
              className={cn(
                'flex items-center gap-2 rounded-xl border px-2.5 py-2 transition-colors',
                active ? 'border-fuchsia-500/40 bg-fuchsia-500/8' : 'border-border/60 hover:bg-muted/40',
              )}
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                onClick={() => onRestore(s)}
              >
                <div
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-lg',
                    s.kind === 'mc' ? 'bg-fuchsia-500/15 text-fuchsia-700' : 'bg-cyan-500/15 text-cyan-800',
                  )}
                >
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold">{s.templateName}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(s.createdAt).toLocaleString('tr-TR', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {s.kind === 'mc' && s.answers ? ` · ${s.answers.length} cevap` : ''}
                    {s.grade ? ` · ${s.grade.score}/${s.grade.max_score}` : ''}
                  </p>
                </div>
              </button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 rounded-lg"
                onClick={() => onDelete(s.id)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
