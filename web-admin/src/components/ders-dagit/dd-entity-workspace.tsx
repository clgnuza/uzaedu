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
  selectedTitle?: string | null;
  footer?: React.ReactNode;
  className?: string;
};

/** Stüdyo tanım sayfaları: modül rayı · kayıt listesi · işlem paneli */
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
    <div className={cn('dd-entity-shell', className)}>
      <div className="dd-entity-grid">
        <aside className="dd-entity-rail" aria-label="Tanım modülleri">
          <DdStudioEntityNav />
        </aside>
        <div className="dd-entity-main">
          <header className="dd-entity-main-head">
            <h2 className="dd-entity-main-title">{title}</h2>
            {toolbar}
          </header>
          <div className="flex min-h-[14rem] flex-1 flex-col overflow-hidden lg:min-h-[22rem]">{list}</div>
          {footer ? <div className="border-t px-3 py-2 text-xs text-muted-foreground">{footer}</div> : null}
        </div>
        {actions ? <aside className="dd-entity-sidebar">{actions}</aside> : null}
      </div>
      {detailOpen && detail ? (
        <section className="dd-entity-detail" aria-label="Seçili kayıt düzenleme">
          <div className="dd-entity-detail-head">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Seçili kayıt
            </p>
            {selectedTitle ? <p className="text-sm font-semibold">{selectedTitle}</p> : null}
          </div>
          <div className="max-h-[min(50vh,420px)] overflow-y-auto p-3">{detail}</div>
        </section>
      ) : null}
    </div>
  );
}
