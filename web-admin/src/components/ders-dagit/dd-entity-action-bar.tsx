'use client';

import { Button } from '@/components/ui/button';
import { ENTITY_KIND_LABEL, type DdEntityKind } from '@/lib/dd-entity-scope';
import { cn } from '@/lib/utils';
import {
  BookMarked,
  Clock,
  Hash,
  Minus,
  Pencil,
  Plus,
  Save,
  type LucideIcon,
} from 'lucide-react';

export type EntityActionKey =
  | 'new'
  | 'edit'
  | 'delete'
  | 'assign'
  | 'timetable'
  | 'constraints'
  | 'save';

export type EntityActionDef = {
  key: EntityActionKey;
  label: string;
  icon?: LucideIcon;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary';
  disabled?: boolean;
  hidden?: boolean;
};

const DEFAULT_ICONS: Record<EntityActionKey, LucideIcon> = {
  new: Plus,
  edit: Pencil,
  delete: Minus,
  assign: BookMarked,
  timetable: Clock,
  constraints: Hash,
  save: Save,
};

type Props = {
  kind: DdEntityKind;
  selectedLabel: string | null;
  actions: EntityActionDef[];
  onAction: (key: EntityActionKey) => void;
  className?: string;
};

/** Seçili kayıt yokken düzenleme/silme/zaman/atama/kısıtlama kapalı (aSc). */
export function DdEntityActionBar({ kind, selectedLabel, actions, onAction, className }: Props) {
  const hasSelection = !!selectedLabel?.trim();

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="dd-glass dd-glass-subtle rounded-lg px-2 py-2 text-xs">
        <p className="font-medium text-muted-foreground">{ENTITY_KIND_LABEL[kind]} — seçili kayıt</p>
        {hasSelection ? (
          <p className="mt-0.5 truncate font-semibold text-foreground" title={selectedLabel!}>
            {selectedLabel}
          </p>
        ) : (
          <p className="mt-0.5 text-muted-foreground">Tablodan bir satır seçin</p>
        )}
        <p className="mt-1 text-[10px] text-muted-foreground">Sağdaki işlemler yalnızca bu kayda uygulanır</p>
      </div>
      <div className="flex flex-row flex-wrap gap-2 lg:flex-col lg:gap-1.5" role="toolbar" aria-label={`${ENTITY_KIND_LABEL[kind]} işlemleri`}>
        {actions
          .filter((a) => !a.hidden)
          .map((a) => {
            const Icon = a.icon ?? DEFAULT_ICONS[a.key];
            const needsSelection = a.key !== 'new';
            const disabled = a.disabled ?? (needsSelection && !hasSelection);
            return (
              <Button
                key={a.key}
                type="button"
                size="sm"
                variant={a.variant ?? (a.key === 'delete' ? 'outline' : a.key === 'new' ? 'secondary' : 'outline')}
                className={cn(
                  'h-auto min-h-9 w-full justify-start gap-2 px-2 py-2 text-left text-xs font-normal',
                  a.key === 'delete' && 'text-destructive hover:text-destructive',
                  a.key === 'save' && 'dd-accent-btn border-0 text-white hover:opacity-95',
                  (a.key === 'assign' || a.key === 'edit') && !disabled && 'border-[rgb(var(--dd-accent)/0.35)] hover:bg-[rgb(var(--dd-accent)/0.08)]',
                )}
                disabled={disabled}
                title={disabled && needsSelection ? 'Önce tablodan seçim yapın' : undefined}
                onClick={() => onAction(a.key)}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {a.label}
              </Button>
            );
          })}
      </div>
    </div>
  );
}
