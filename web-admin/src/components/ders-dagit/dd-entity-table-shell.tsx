'use client';

import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  placeholder: string;
  query: string;
  onQueryChange: (q: string) => void;
  children: React.ReactNode;
  className?: string;
};

export function DdEntityTableShell({ placeholder, query, onQueryChange, children, className }: Props) {
  return (
    <div className={cn('dd-entity-table-wrap flex min-h-0 flex-1 flex-col', className)}>
      <div className="dd-entity-search-bar">
        <Search className="dd-entity-search-icon" aria-hidden />
        <input
          type="search"
          placeholder={placeholder}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          className="dd-entity-search"
        />
      </div>
      <div className="dd-entity-table-scroll">{children}</div>
    </div>
  );
}

export function ddEntityRowClass(active: boolean, extra?: string) {
  return cn('dd-entity-row', active && 'dd-entity-row-active', extra);
}
