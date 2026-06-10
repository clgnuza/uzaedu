import { cn } from '@/lib/utils';

export const AGENDA_DIALOG_CLASS =
  'max-w-[min(100%,22.5rem)] sm:max-w-md [&>div:first-of-type]:px-3 [&>div:first-of-type]:py-2 [&>div:last-child]:p-3 sm:[&>div:last-child]:p-3.5';

export const AGENDA_DIALOG_WIDE = cn(AGENDA_DIALOG_CLASS, 'sm:max-w-lg');

export const agendaLabel = 'text-[10px] font-semibold uppercase tracking-wide text-muted-foreground';

export const agendaInput =
  'mt-0.5 h-8 rounded-md border-border/80 bg-background px-2.5 text-xs shadow-sm focus-visible:ring-1 sm:text-[13px]';

export const agendaTextarea =
  'mt-0.5 min-h-[2.75rem] max-h-24 w-full resize-y rounded-md border border-input bg-background px-2.5 py-1.5 text-xs leading-snug shadow-sm sm:text-[13px]';

export const agendaSection =
  'rounded-lg border border-border/60 bg-linear-to-br from-muted/30 to-background/80 px-2 py-1.5';

export function AgendaFormActions({
  onCancel,
  loading,
  submitLabel,
  disabled,
}: {
  onCancel: () => void;
  loading?: boolean;
  submitLabel: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-1.5 border-t border-border/60 pt-2.5">
      <button
        type="button"
        onClick={onCancel}
        className="h-8 rounded-md border border-border/80 bg-background px-3 text-xs font-medium text-foreground hover:bg-muted/60"
      >
        İptal
      </button>
      <button
        type="submit"
        disabled={disabled || loading}
        className="h-8 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {loading ? 'Kaydediliyor…' : submitLabel}
      </button>
    </div>
  );
}

export function AgendaClassPills({
  classes,
  value,
  onChange,
  label = 'Sınıf',
  emptyLabel = 'Yok',
}: {
  classes: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
  emptyLabel?: string;
}) {
  if (classes.length === 0) return null;
  return (
    <div className={agendaSection}>
      <span className={agendaLabel}>{label}</span>
      <div className="mt-1 flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => onChange('')}
          className={cn(
            'rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors',
            !value
              ? 'border-violet-500/40 bg-violet-500/15 text-violet-900 dark:text-violet-100'
              : 'border-border/70 bg-background/80 text-muted-foreground hover:bg-muted/50',
          )}
        >
          {emptyLabel}
        </button>
        {classes.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(c.id)}
            className={cn(
              'rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors',
              value === c.id
                ? 'border-violet-500/40 bg-violet-500/15 text-violet-900 dark:text-violet-100'
                : 'border-border/70 bg-background/80 text-muted-foreground hover:bg-muted/50',
            )}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function AgendaPriorityPills({
  value,
  onChange,
}: {
  value: 'low' | 'medium' | 'high';
  onChange: (v: 'low' | 'medium' | 'high') => void;
}) {
  const opts: { v: 'low' | 'medium' | 'high'; label: string; active: string }[] = [
    { v: 'low', label: 'Düşük', active: 'bg-slate-600/15 text-slate-800 dark:text-slate-200' },
    { v: 'medium', label: 'Orta', active: 'bg-sky-500/15 text-sky-800 dark:text-sky-200' },
    { v: 'high', label: 'Yüksek', active: 'bg-rose-500/15 text-rose-800 dark:text-rose-200' },
  ];
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={cn(
            'rounded-md border border-border/70 px-2 py-1 text-[10px] font-semibold transition-colors hover:bg-muted/50',
            value === o.v ? cn('border-primary/30 ring-1 ring-primary/20', o.active) : 'text-muted-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
