'use client';

import Link from 'next/link';
import { Clock, Eye, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type LessonCellCardProps = {
  subject: string;
  classSection: string;
  timeRange: string;
  onRemove?: () => void;
  onView?: () => void;
  /** Varsa kazanım takip sayfasına gider; tıklanabilir */
  kazanimHref?: string;
  editable?: boolean;
  compact?: boolean;
};

/** Ders hücresi kartı – tablo içinde sınıf-ders bilgisi ve opsiyonel saat. */
export function LessonCellCard({
  subject,
  classSection,
  timeRange,
  onRemove,
  onView,
  kazanimHref,
  editable = false,
  compact = false,
}: LessonCellCardProps) {
  const title = classSection ? `${classSection} · ${subject}` : subject;

  const content = (
    <div
      className={cn(
        'group rounded-lg border border-primary/15 bg-gradient-to-br from-primary/5 to-primary/10 shadow-sm transition-all',
        kazanimHref && 'cursor-pointer hover:border-primary/30 hover:shadow-md hover:from-primary/8 hover:to-primary/15',
        compact ? 'px-2 py-1.5' : 'px-3 py-2',
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-foreground text-xs leading-tight truncate">
            {title}
          </div>
          {!compact && (
            <div className="flex items-center gap-0.5 mt-0.5 text-[10px] text-muted-foreground">
              <Clock className="size-3 shrink-0" />
              {timeRange}
            </div>
          )}
          {compact && timeRange && (
            <div className="text-[10px] text-muted-foreground truncate mt-0.5">{timeRange}</div>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {kazanimHref && !editable && (
            <span className="rounded-md p-1 text-primary hover:bg-primary/20 transition-colors" title="Kazanımlara git">
              <Eye className="size-3.5" />
            </span>
          )}
          {onView && !kazanimHref && !editable && (
            <button
              type="button"
              onClick={onView}
              className="rounded-md p-1 text-primary hover:bg-primary/20 transition-colors"
              title="Detay"
            >
              <Eye className="size-3.5" />
            </button>
          )}
          {editable && onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="opacity-0 group-hover:opacity-100 rounded-md p-1 text-destructive hover:bg-destructive/15 transition-all"
              title="Kaldır"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (kazanimHref) {
    return <Link href={kazanimHref} className="block">{content}</Link>;
  }
  return content;
}
