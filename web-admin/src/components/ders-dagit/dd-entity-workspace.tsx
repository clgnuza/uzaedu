'use client';

import { DdStudioEntityNav } from '@/components/ders-dagit/dd-studio-entity-nav';
import { cn } from '@/lib/utils';

type Props = {
  title: string;
  toolbar?: React.ReactNode;
  actions?: React.ReactNode;
  list: React.ReactNode;
  detail?: React.ReactNode;
  detailOpen?: boolean;
  /** Seçili kayıt başlığı (detay paneli üstü) */
  selectedTitle?: string | null;
  footer?: React.ReactNode;
  className?: string;
};

/** Stüdyo: sol modül ikonları · ortada tablo · sağda aksiyonlar · altta seçili kayıt paneli */
export function DdEntityWorkspace({
  title,
  toolbar,
  actions,
  list,
  detail,
  detailOpen,
  selectedTitle,
  footer,
  className,
}: Props) {
  return (
    <div className={cn('flex min-h-0 flex-col gap-3', className)}>
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row lg:gap-4">
        <aside className="shrink-0 lg:w-14">
          <DdStudioEntityNav />
        </aside>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 lg:flex-row">
          <div className="dd-glass-panel flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
              {toolbar}
            </div>
            <div className="flex min-h-[14rem] flex-1 flex-col overflow-hidden lg:min-h-[22rem]">{list}</div>
            {footer ? <div className="border-t px-3 py-2 text-xs text-muted-foreground">{footer}</div> : null}
          </div>
          {actions ? (
            <aside className="flex shrink-0 flex-row flex-wrap gap-2 border-t pt-3 lg:w-40 lg:flex-col lg:border-t-0 lg:border-l lg:pt-0 lg:pl-2">
              {actions}
            </aside>
          ) : null}
        </div>
      </div>
      {detailOpen && detail ? (
        <div className="dd-glass-panel border-primary/20">
          <div className="border-b bg-primary/5 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Yalnızca seçili kayıt</p>
            {selectedTitle ? <p className="text-sm font-semibold">{selectedTitle}</p> : null}
          </div>
          <div className="max-h-[min(50vh,420px)] overflow-y-auto p-3">{detail}</div>
        </div>
      ) : null}
    </div>
  );
}
