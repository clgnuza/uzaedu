'use client';

import Link from 'next/link';
import { Star, FileText, Users, BookOpen, Search, User, LayoutGrid, Trash2, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  formatAcademicWeekHeading,
  getAcademicWeekKind,
  getCurrentWeekIndex,
  isNonTeachingWeek,
} from '@/lib/academic-week-label';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export interface AssignedUserView {
  userId: string;
  displayName: string | null;
  gorevTipi: 'sorumlu' | 'yardimci';
}

export interface WeekItem {
  id: string;
  title: string;
  path: string | null;
  iconKey: string | null;
  sortOrder: number;
  assignedUsers?: AssignedUserView[];
}

export interface WeekWithItems {
  id: string;
  academicYear: string;
  weekNumber: number;
  weekOrder?: number;
  title: string | null;
  dateStart: string | null;
  dateEnd: string | null;
  sortOrder: number;
  isTatil?: boolean;
  ay?: string;
  belirliGunHafta: WeekItem[];
  ogretmenIsleri: WeekItem[];
}

export {
  findWeekIndexForDate,
  formatAcademicWeekHeading,
  formatAcademicWeekShort,
  getAcademicWeekKind,
  getAcademicWeekKindLabel,
  getCurrentWeekIndex,
  isDateInAcademicWeek,
  isNonTeachingWeek,
} from '@/lib/academic-week-label';

function weekCircleLabel(week: WeekWithItems): string {
  if (isNonTeachingWeek(week)) {
    const k = getAcademicWeekKind(week);
    if (k === 'seminer') return 'S';
    if (k === 'ara_tatil') return 'A';
    if (k === 'yariyil') return 'Y';
    return '·';
  }
  return String(week.weekOrder && week.weekOrder > 0 ? week.weekOrder : week.weekNumber);
}

const OGRETMEN_ICONS: Record<string, LucideIcon> = {
  'Öğretmenler Kurulu': Users,
  'Zümre Tutanakları': FileText,
  'Yıllık Planlar': BookOpen,
  'BEP Programı': User,
  'Kulüp Planları': LayoutGrid,
  'Şeflik Planlar': LayoutGrid,
  'Kazanım Ara': Search,
  'Öğretmen Ağı': User,
  'Günlük Planlar': FileText,
  'Kulüp Raporu': FileText,
  'Şeflik Raporu': FileText,
  'Sınav Hazırla': FileText,
  'Soru Üret': Search,
  'Sınav Analizleri': FileText,
  'Performans Değerlendir': FileText,
  'Veli Toplantıları': Users,
  'Proje Asistanı': User,
  'İdareye Teslim Evraklar': FileText,
  default: FileText,
};

export function formatDateRange(start: string | null, end: string | null) {
  if (!start || !end) return '';
  const s = new Date(start);
  const e = new Date(end);
  const sameYear = s.getFullYear() === e.getFullYear();
  return sameYear
    ? `${s.getDate()} ${s.toLocaleDateString('tr-TR', { month: 'short' })} - ${e.getDate()} ${e.toLocaleDateString('tr-TR', { month: 'short' })} ${e.getFullYear()}`
    : `${s.getDate()} ${s.toLocaleDateString('tr-TR', { month: 'short' })} ${s.getFullYear()} - ${e.getDate()} ${e.toLocaleDateString('tr-TR', { month: 'short' })} ${e.getFullYear()}`;
}

function getOgretmenIcon(title: string) {
  return OGRETMEN_ICONS[title] ?? OGRETMEN_ICONS.default;
}

/** Belirli Gün ve Haftalar – turuncu pill */
export function BelirliPill({
  title,
  path,
  className,
  isLink = true,
}: {
  title: string;
  path: string | null;
  className?: string;
  isLink?: boolean;
}) {
  const pill = (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800',
        'dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
        className
      )}
    >
      <Star className="size-3.5 shrink-0" aria-hidden />
      {title}
    </span>
  );
  if (path && isLink) {
    return (
      <Link href={path} className="transition-opacity hover:opacity-90">
        {pill}
      </Link>
    );
  }
  return pill;
}

/** Öğretmen İşleri – mavi pill */
export function OgretmenPill({
  title,
  path,
  className,
  isLink = true,
}: {
  title: string;
  path: string | null;
  className?: string;
  isLink?: boolean;
}) {
  const Icon = getOgretmenIcon(title);
  const pill = (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3.5 py-1.5 text-sm font-medium text-blue-800',
        'dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200',
        className
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {title}
    </span>
  );
  if (path && isLink) {
    return (
      <Link href={path} className="transition-opacity hover:opacity-90">
        {pill}
      </Link>
    );
  }
  return pill;
}

/** Tek hafta kartı – timeline ile bağlı, sol tarafta yuvarlak rozet */
export function AcademicCalendarWeekCard({
  week,
  isCurrentWeek = false,
  showConnector = true,
}: {
  week: WeekWithItems;
  isCurrentWeek?: boolean;
  showConnector?: boolean;
}) {
  const dateRange = formatDateRange(week.dateStart, week.dateEnd);

  return (
    <div className="relative flex gap-6">
      {/* Sol: hafta rozeti + aşağı bağlantı çizgisi */}
      <div className="relative flex shrink-0 flex-col items-center">
        <div
          className={cn(
            'relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold',
            isCurrentWeek
              ? 'border-primary bg-primary text-primary-foreground shadow-lg ring-4 ring-primary/20'
              : 'border-muted-foreground/25 bg-background text-muted-foreground shadow-sm'
          )}
        >
          {weekCircleLabel(week)}
        </div>
        {showConnector && <div className="h-8 w-0.5 shrink-0 bg-muted-foreground/20" />}
      </div>

      {/* Sağ: hafta kartı */}
      <div
        className={cn(
          'mb-2 min-w-0 flex-1 rounded-xl border bg-card p-6 shadow-sm transition-all',
          isCurrentWeek ? 'border-primary/30 ring-2 ring-primary/15 shadow-md' : 'border-border hover:shadow-md'
        )}
      >
        <div className="mb-5 text-base font-semibold text-muted-foreground">
          {formatAcademicWeekHeading(week)}
          {dateRange ? ` · ${dateRange}` : ''}
        </div>

        {week.belirliGunHafta.length > 0 && (
          <div className="mb-5">
            <div className="mb-2.5 flex items-center gap-2 text-sm font-bold text-foreground">
              <Star className="size-4 text-amber-500" aria-hidden />
              Belirli Gün ve Haftalar
            </div>
            <div className="flex flex-wrap gap-2">
              {week.belirliGunHafta.map((item) => (
                <BelirliPill key={item.id} title={item.title} path={item.path} />
              ))}
            </div>
          </div>
        )}

        {week.ogretmenIsleri.length > 0 && (
          <div>
            <div className="mb-2.5 flex items-center gap-2 text-sm font-bold text-foreground">
              <FileText className="size-4 text-blue-500" aria-hidden />
              Öğretmen İşleri
            </div>
            <div className="flex flex-wrap gap-2">
              {week.ogretmenIsleri.map((item) => (
                <OgretmenPill key={item.id} title={item.title} path={item.path} />
              ))}
            </div>
          </div>
        )}

        {week.belirliGunHafta.length === 0 && week.ogretmenIsleri.length === 0 && (
          <p className="text-sm text-muted-foreground italic">Bu haftada etkinlik yok.</p>
        )}
      </div>
    </div>
  );
}

/** Palet öğesi – yukarıdaki iş listesinden sürüklenebilir */
export function AcademicCalendarPaletteItem({
  id,
  title,
  variant,
  compact = false,
}: {
  id: string;
  title: string;
  variant: 'belirli' | 'ogretmen';
  /** Dar palet: tek sütun, kısa chip */
  compact?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { type: 'palette', section: variant, title },
  });
  const baseClass =
    variant === 'belirli'
      ? 'border-amber-200/80 bg-amber-50 text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/45 dark:text-amber-100'
      : 'border-sky-200/80 bg-sky-50 text-sky-900 dark:border-sky-800/60 dark:bg-sky-950/45 dark:text-sky-100';
  return (
    <span
      ref={setNodeRef}
      title={title}
      {...attributes}
      {...listeners}
      className={cn(
        'cursor-grab border font-medium active:cursor-grabbing',
        compact
          ? 'flex w-full min-w-0 items-center gap-1 rounded-lg px-2 py-1 text-[10px] leading-tight'
          : 'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm',
        !compact && variant === 'ogretmen' && 'gap-2 px-3.5',
        baseClass,
        isDragging && 'opacity-40',
      )}
    >
      {variant === 'belirli' && <Star className={cn('shrink-0', compact ? 'size-3' : 'size-3.5')} aria-hidden />}
      {variant === 'ogretmen' &&
        (() => {
          const Icon = getOgretmenIcon(title);
          return <Icon className={cn('shrink-0', compact ? 'size-3' : 'size-3.5')} aria-hidden />;
        })()}
      <span className={cn(compact && 'min-w-0 truncate')}>{title}</span>
    </span>
  );
}

/** Sürüklerken DragOverlay içinde kullanılır */
export function PaletteDragOverlayContent({
  title,
  variant,
}: {
  title: string;
  variant: 'belirli' | 'ogretmen';
}) {
  const baseClass =
    variant === 'belirli'
      ? 'inline-flex items-center gap-1.5 rounded-full border-2 border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-900 shadow-lg dark:border-amber-600 dark:bg-amber-950/90 dark:text-amber-100'
      : 'inline-flex items-center gap-2 rounded-full border-2 border-blue-300 bg-blue-50 px-3.5 py-1.5 text-sm font-medium text-blue-900 shadow-lg dark:border-blue-600 dark:bg-blue-950/90 dark:text-blue-100';
  return (
    <span className={cn(baseClass, 'cursor-grabbing')}>
      {variant === 'belirli' && <Star className="size-3.5 shrink-0" aria-hidden />}
      {variant === 'ogretmen' && (() => {
        const Icon = getOgretmenIcon(title);
        return <Icon className="size-3.5 shrink-0" aria-hidden />;
      })()}
      {title}
    </span>
  );
}

/** Bırakılabilir alan – palet öğesini buraya bırakınca haftaya eklenir */
export function AcademicCalendarDropZone({
  weekId,
  section,
  isEmpty,
  children,
  paletteDragSection = null,
}: {
  weekId: string;
  section: 'belirli' | 'ogretmen';
  isEmpty: boolean;
  children: React.ReactNode;
  /** Paletten sürüklenen öğe türü; eşleşmeyen alanlar devre dışı */
  paletteDragSection?: 'belirli' | 'ogretmen' | null;
}) {
  const dropId = `drop__${weekId}__${section}`;
  const acceptsDrop = paletteDragSection == null || paletteDragSection === section;
  const rejectsDrop = paletteDragSection != null && paletteDragSection !== section;
  const { isOver, setNodeRef } = useDroppable({
    id: dropId,
    data: { weekId, section },
    disabled: rejectsDrop,
  });
  const accent =
    section === 'belirli'
      ? {
          idle: 'border-amber-300/50 bg-amber-500/5 dark:border-amber-800/40',
          over: 'border-amber-500 bg-amber-500/15 ring-2 ring-amber-400/35',
          reject: 'border-border/40 bg-muted/15 opacity-45',
          label: 'Belirli gün öğeleri',
        }
      : {
          idle: 'border-sky-300/50 bg-sky-500/5 dark:border-sky-800/40',
          over: 'border-sky-500 bg-sky-500/15 ring-2 ring-sky-400/35',
          reject: 'border-border/40 bg-muted/15 opacity-45',
          label: 'Öğretmen işi öğeleri',
        };
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'min-h-10 rounded-lg px-2 py-1.5 transition-all',
        isEmpty ? 'flex items-center border-2 border-dashed' : 'border',
        rejectsDrop ? accent.reject : isEmpty ? accent.idle : 'border-transparent bg-muted/10',
        isOver && acceptsDrop && accent.over,
      )}
    >
      {isEmpty ? (
        <span className="w-full px-1 text-center text-[10px] leading-snug text-muted-foreground">
          {rejectsDrop ? (
            <span className="text-muted-foreground/70">Bu alana bırakılamaz</span>
          ) : isOver ? (
            <span className="font-semibold text-foreground">Bırakın — eklenecek</span>
          ) : (
            <>
              {section === 'belirli' ? '★' : '●'} {accent.label}
              <span className="mt-0.5 block text-[9px] opacity-75">Yalnızca eşleşen palet öğesi</span>
            </>
          )}
        </span>
      ) : (
        <div className="space-y-1.5">
          {children}
          {!rejectsDrop && (
            <p className={cn('text-center text-[9px] text-muted-foreground/80', isOver && 'font-medium text-foreground')}>
              {isOver ? 'Buraya bırakın' : 'Ek öğe için buraya bırakın'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Düzenlenebilir hafta kartı – sürükle-bırak + silme (şablon sayfası için). DndContext sayfa seviyesinde sağlanmalıdır. */
export function AcademicCalendarWeekCardEdit({
  week,
  showConnector = true,
  onDeleteItem,
}: {
  week: WeekWithItems;
  showConnector?: boolean;
  onDeleteItem: (id: string) => void;
}) {
  const dateRange = formatDateRange(week.dateStart, week.dateEnd);
  const belirli = week.belirliGunHafta ?? [];
  const ogretmen = week.ogretmenIsleri ?? [];

  return (
    <div className="relative flex gap-6">
      <div className="relative flex shrink-0 flex-col items-center">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/25 bg-background text-sm font-bold text-muted-foreground shadow-sm">
          {weekCircleLabel(week)}
        </div>
        {showConnector && <div className="h-8 w-0.5 shrink-0 bg-muted-foreground/20" />}
      </div>
      <div className="mb-2 min-w-0 flex-1 rounded-xl border border-border bg-card p-6 shadow-sm hover:shadow-md">
        <div className="mb-5 text-base font-semibold text-muted-foreground">
          {formatAcademicWeekHeading(week)}
          {dateRange ? ` · ${dateRange}` : ''}
        </div>
        <div className="mb-5">
          <div className="mb-2.5 flex items-center gap-2 text-sm font-bold text-foreground">
            <Star className="size-4 text-amber-500" aria-hidden />
            Belirli Gün ve Haftalar
          </div>
          <AcademicCalendarDropZone weekId={week.id} section="belirli" isEmpty={belirli.length === 0}>
            <SortableContext items={belirli.map((i) => i.id)}>
              <div className="flex flex-wrap gap-2">
                {belirli.map((item) => (
                  <SortablePill
                    key={item.id}
                    id={item.id}
                    title={item.title}
                    variant="belirli"
                    weekId={week.id}
                    section="belirli"
                    onDelete={() => onDeleteItem(item.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </AcademicCalendarDropZone>
        </div>
        <div>
          <div className="mb-2.5 flex items-center gap-2 text-sm font-bold text-foreground">
            <FileText className="size-4 text-blue-500" aria-hidden />
            Öğretmen İşleri
          </div>
          <AcademicCalendarDropZone weekId={week.id} section="ogretmen" isEmpty={ogretmen.length === 0}>
            <SortableContext items={ogretmen.map((i) => i.id)}>
              <div className="flex flex-wrap gap-2">
                {ogretmen.map((item) => (
                  <SortablePill
                    key={item.id}
                    id={item.id}
                    title={item.title}
                    variant="ogretmen"
                    weekId={week.id}
                    section="ogretmen"
                    onDelete={() => onDeleteItem(item.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </AcademicCalendarDropZone>
        </div>
        {belirli.length === 0 && ogretmen.length === 0 && (
          <p className="mt-2 text-sm text-muted-foreground italic">Paletten sürükleyip bırakın veya Öğe Ekle ile ekleyin.</p>
        )}
      </div>
    </div>
  );
}

function SortablePill({
  id,
  title,
  variant,
  weekId,
  section,
  onDelete,
}: {
  id: string;
  title: string;
  variant: 'belirli' | 'ogretmen';
  weekId?: string;
  section?: 'belirli' | 'ogretmen';
  onDelete?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id,
    data: weekId && section ? { weekId, section } : undefined,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const baseClass =
    variant === 'belirli'
      ? 'inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200'
      : 'inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3.5 py-1.5 text-sm font-medium text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200';

  return (
    <span
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(baseClass, 'cursor-grab active:cursor-grabbing group')}
    >
      {variant === 'belirli' && <Star className="size-3.5 shrink-0" aria-hidden />}
      {variant === 'ogretmen' && (() => {
        const Icon = getOgretmenIcon(title);
        return <Icon className="size-3.5 shrink-0" aria-hidden />;
      })()}
      {title}
      {onDelete && (
        <button
          type="button"
          onPointerDown={(ev) => ev.stopPropagation()}
          onClick={(ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            onDelete();
          }}
          className="ml-1.5 rounded p-0.5 text-muted-foreground transition-opacity hover:bg-destructive/20 hover:text-destructive focus:opacity-100 focus:outline-none group-hover:opacity-100 md:opacity-70"
          aria-label="Sil"
        >
          <Trash2 className="size-3" />
        </button>
      )}
    </span>
  );
}

/** Öğretim hafta numarası (0 = seminer/tatil haftasındayız) */
export function getCurrentWeekOrder(weeks: WeekWithItems[]): number {
  const idx = getCurrentWeekIndex(weeks);
  if (idx < 0) return -1;
  const w = weeks[idx];
  const order = w.weekOrder ?? w.weekNumber;
  return order > 0 ? order : 0;
}
