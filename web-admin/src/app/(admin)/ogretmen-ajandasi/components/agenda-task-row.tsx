'use client';

import { Button } from '@/components/ui/button';
import { Check, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { AgendaTaskMetaIcons } from './agenda-task-icons';

export type AgendaTaskRowModel = {
  id: string;
  title: string;
  dueDate?: string | null;
  status: string;
  priority: string;
  repeat?: string | null;
  reminders?: { id: string; remindAt: string; pushSent?: boolean }[];
};

type Props = {
  task: AgendaTaskRowModel;
  selected: boolean;
  onSelectChange: (checked: boolean) => void;
  completeChecked: boolean;
  completeDisabled: boolean;
  onCompleteChange: () => void;
  onEdit: () => void;
  onDelete: () => void;
  overdue: boolean;
  formatYmdSlash: (ymd: string | null | undefined) => string;
};

export function AgendaTaskRow({
  task: t,
  selected,
  onSelectChange,
  completeChecked,
  completeDisabled,
  onCompleteChange,
  onEdit,
  onDelete,
  overdue,
  formatYmdSlash,
}: Props) {
  const hasPendingReminder = !!(t.reminders ?? []).some((r) => !r.pushSent);

  return (
    <li
      className={cn(
        'group touch-manipulation rounded-lg border border-border/80 bg-card shadow-sm transition-all max-sm:rounded-md max-sm:px-2 max-sm:py-1.5 sm:flex sm:flex-row sm:rounded-xl sm:px-4 sm:py-3.5',
        'max-sm:gap-1.5 sm:min-h-[52px] sm:items-center sm:gap-3',
        'hover:border-emerald-400/40 hover:shadow-md hover:ring-1 hover:ring-emerald-500/15',
        overdue && 'border-destructive/45 bg-destructive/5 ring-1 ring-destructive/15',
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
        <div className="flex min-w-0 items-start gap-2 sm:contents sm:gap-2">
          <button
            type="button"
            role="checkbox"
            aria-checked={selected}
            title="Toplu işlem için seç"
            onClick={(e) => {
              e.stopPropagation();
              onSelectChange(!selected);
            }}
            className={cn(
              'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:mt-0 sm:size-[22px]',
              selected
                ? 'border-primary bg-primary/12 text-primary shadow-sm ring-1 ring-primary/20'
                : 'border-dashed border-muted-foreground/45 bg-muted/20 text-muted-foreground hover:border-muted-foreground/65 hover:bg-muted/35',
            )}
          >
            {selected ? <Check className="size-3 stroke-[2.75]" aria-hidden /> : null}
          </button>
          <button
            type="button"
            role="checkbox"
            aria-checked={completeChecked}
            title={completeChecked ? 'Bekleyen olarak işaretle' : 'Tamamlandı olarak işaretle'}
            disabled={completeDisabled}
            onClick={(e) => {
              e.stopPropagation();
              onCompleteChange();
            }}
            className={cn(
              'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-95 sm:mt-0 sm:size-8',
              completeChecked
                ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm shadow-emerald-600/20 dark:border-emerald-500 dark:bg-emerald-600'
                : 'border-muted-foreground/40 bg-background hover:border-emerald-500/55 hover:bg-emerald-500/[0.07]',
              completeDisabled && 'pointer-events-none opacity-45',
            )}
          >
            {completeChecked ? <Check className="size-3.5 stroke-[2.75] sm:size-4" aria-hidden /> : null}
          </button>
          <button
            type="button"
            className="min-w-0 flex-1 cursor-pointer rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-0"
            onClick={onEdit}
          >
            <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-1.5">
              <AgendaTaskMetaIcons
                priority={t.priority}
                repeat={t.repeat}
                hasPendingReminder={hasPendingReminder}
                className="w-fit shrink-0 bg-muted/50 ring-border/40"
              />
              <span
                className={cn(
                  'min-w-0 max-w-full truncate text-[13px] font-semibold leading-snug sm:text-sm',
                  t.status === 'completed' && 'text-muted-foreground line-through',
                )}
              >
                {t.title}
              </span>
            </div>
          </button>
        </div>
      </div>
      <div className="mt-1 flex items-center justify-end gap-1.5 max-sm:border-t max-sm:border-border/40 max-sm:pt-1 sm:mt-0 sm:shrink-0 sm:border-0 sm:pt-0">
        {t.dueDate ? (
          <span
            className={cn(
              'text-[11px] tabular-nums sm:text-xs',
              overdue ? 'font-semibold text-destructive' : 'text-muted-foreground',
            )}
          >
            <span className="sm:hidden">{formatYmdSlash(t.dueDate)}</span>
            <span className="hidden sm:inline">{format(new Date(`${t.dueDate}T12:00:00`), 'd MMM', { locale: tr })}</span>
          </span>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 shrink-0 p-0 text-muted-foreground opacity-100 hover:text-destructive sm:h-8 sm:w-8 sm:opacity-0 sm:group-hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label="Sil"
        >
          <Trash2 className="size-3.5 sm:size-4" strokeWidth={2} />
        </Button>
      </div>
    </li>
  );
}
