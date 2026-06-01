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

export function DdEntityActionBar({ kind, selectedLabel, actions, onAction, className }: Props) {
  const hasSelection = !!selectedLabel?.trim();

  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      <div className="dd-entity-selection">
        <p className="dd-entity-selection-label">{ENTITY_KIND_LABEL[kind]}</p>
        {hasSelection ? (
          <p className="dd-entity-selection-name truncate" title={selectedLabel!}>
            {selectedLabel}
          </p>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">Listeden bir satır seçin</p>
        )}
      </div>
      <div className="dd-entity-action-list" role="toolbar" aria-label={`${ENTITY_KIND_LABEL[kind]} işlemleri`}>
        {actions
          .filter((a) => !a.hidden)
          .map((a) => {
            const Icon = a.icon ?? DEFAULT_ICONS[a.key];
            const needsSelection = a.key !== 'new';
            const disabled = a.disabled ?? (needsSelection && !hasSelection);
            const variant =
              a.variant ?? (a.key === 'delete' ? 'outline' : a.key === 'new' ? 'secondary' : 'outline');
            return (
              <Button
                key={a.key}
                type="button"
                size="sm"
                variant={variant}
                className={cn(
                  'dd-entity-action-btn w-full',
                  a.key === 'save' && 'dd-entity-action-btn-primary',
                  a.key === 'delete' &&
                    variant === 'outline' &&
                    'text-destructive hover:bg-destructive/10 hover:text-destructive',
                  a.key === 'delete' &&
                    variant === 'destructive' &&
                    'text-destructive-foreground hover:text-destructive-foreground',
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
