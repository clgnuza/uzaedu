'use client';

import { useDraggable, useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Star, Target, Users, FileText, Trash2, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BilsemItemType } from '@/config/bilsem-palette';

export type BilsemItem = {
  id: string;
  title: string;
  path: string | null;
  iconKey: string | null;
  sortOrder: number;
  itemType: string;
};

export type BilsemWeek = {
  id: string;
  academicYear: string;
  weekNumber: number;
  title: string | null;
  dateStart: string | null;
  dateEnd: string | null;
  sortOrder: number;
  items: BilsemItem[];
};

const ITEM_TYPE_STYLES: Record<string, { bg: string; icon: typeof Star }> = {
  belirli_gun_hafta: {
    bg: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
    icon: Star,
  },
  dep: {
    bg: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200',
    icon: Target,
  },
  tanilama: {
    bg: 'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200',
    icon: Users,
  },
  diger: {
    bg: 'border-zinc-200 bg-zinc-100 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200',
    icon: FileText,
  },
};

export function formatBilsemDateRange(start: string | null, end: string | null): string {
  if (!start || !end) return '';
  const s = new Date(start + 'T12:00:00');
  const e = new Date(end + 'T12:00:00');
  const fmt = (d: Date) => d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  return `${fmt(s)} – ${fmt(e)}`;
}

/** Palet öğesi – sürüklenebilir */
export function BilsemPaletteItem({
  id,
  type,
  title,
}: {
  id: string;
  type: BilsemItemType;
  title: string;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { type: 'palette', itemType: type, title },
  });
  const style = ITEM_TYPE_STYLES[type] ?? ITEM_TYPE_STYLES.diger;
  const Icon = style.icon;
  return (
    <span
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium',
        style.bg,
        'cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-50'
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {title}
    </span>
  );
}

/** Bırakılabilir alan – haftaya öğe eklemek için */
export function BilsemDropZone({
  weekId,
  isEmpty,
  children,
}: {
  weekId: string;
  isEmpty: boolean;
  children: React.ReactNode;
}) {
  const dropId = `bilsem-drop__${weekId}`;
  const { isOver, setNodeRef } = useDroppable({
    id: dropId,
    data: { weekId },
  });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'min-h-[52px] min-w-[200px] rounded-lg py-2 transition-colors',
        isOver && 'bg-primary/10 ring-2 ring-primary/30',
        isEmpty && 'flex items-center justify-center'
      )}
    >
      {isEmpty ? (
        <span className="py-2 text-center text-xs text-muted-foreground">Buraya bırakın</span>
      ) : (
        children
      )}
    </div>
  );
}

/** Sıralanabilir etkinlik pill */
function BilsemSortablePill({
  item,
  onDelete,
  onEdit,
}: {
  item: BilsemItem;
  onDelete: () => void;
  onEdit?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: item.id,
    data: { type: 'item', weekId: '', itemId: item.id },
  });
  const style = ITEM_TYPE_STYLES[item.itemType] ?? ITEM_TYPE_STYLES.diger;
  const Icon = style.icon;
  return (
    <span
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium group',
        style.bg,
        'cursor-grab active:cursor-grabbing'
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {item.title}
      <button
        type="button"
        onPointerDown={(ev) => ev.stopPropagation()}
        onClick={(ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          onEdit?.();
        }}
        className="ml-1 rounded p-0.5 text-muted-foreground transition-opacity hover:bg-primary/20 hover:text-primary md:opacity-70 group-hover:opacity-100"
        aria-label="Düzenle"
      >
        <Pencil className="size-3" aria-hidden />
      </button>
      <button
        type="button"
        onPointerDown={(ev) => ev.stopPropagation()}
        onClick={(ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          onDelete();
        }}
        className="rounded p-0.5 text-muted-foreground transition-opacity hover:bg-destructive/20 hover:text-destructive md:opacity-70 group-hover:opacity-100"
        aria-label="Sil"
      >
        <Trash2 className="size-3" aria-hidden />
      </button>
    </span>
  );
}

/** Timeline stilinde hafta kartı – Akademik Takvim Şablonu ile uyumlu */
export function BilsemWeekCardEdit({
  week,
  showConnector = true,
  onDeleteItem,
  onEditItem,
}: {
  week: BilsemWeek;
  showConnector?: boolean;
  onDeleteItem: (id: string) => void;
  onEditItem?: (item: BilsemItem, weekId: string) => void;
}) {
  const dateRange = formatBilsemDateRange(week.dateStart, week.dateEnd);
  const items = week.items ?? [];

  return (
    <div className="relative flex gap-6">
      <div className="relative flex shrink-0 flex-col items-center">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/25 bg-background text-sm font-bold text-muted-foreground shadow-sm">
          {week.weekNumber}
        </div>
        {showConnector && <div className="h-8 w-0.5 shrink-0 bg-muted-foreground/20" />}
      </div>
      <div className="mb-2 min-w-0 flex-1 rounded-xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
        <div className="mb-5 text-base font-semibold text-muted-foreground">
          {dateRange || week.title || `${week.weekNumber}. Hafta`}
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold text-foreground">
            <GripVertical className="size-4 text-muted-foreground" aria-hidden />
            Etkinlikler
          </div>
          <BilsemDropZone weekId={week.id} isEmpty={items.length === 0}>
            <SortableContext items={items.map((i) => i.id)}>
              <div className="flex flex-wrap gap-2">
                {items.map((item) => (
                  <BilsemSortablePill
                    key={item.id}
                    item={item}
                    onDelete={() => onDeleteItem(item.id)}
                    onEdit={onEditItem ? () => onEditItem(item, week.id) : undefined}
                  />
                ))}
              </div>
            </SortableContext>
          </BilsemDropZone>
        </div>
        {items.length === 0 && (
          <p className="mt-2 text-sm text-muted-foreground italic">Paletten sürükleyip bırakın veya Öğe Ekle ile ekleyin.</p>
        )}
      </div>
    </div>
  );
}
