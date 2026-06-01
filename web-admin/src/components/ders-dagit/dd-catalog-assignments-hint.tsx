import { Info } from 'lucide-react';
import { DD_CATALOG_ASSIGNMENTS_HINT, DD_SHARED_ASSIGNMENTS_HINT } from '@/lib/dd-entity-scope';

type Props = { catalog?: boolean };

export function DdCatalogAssignmentsHint({ catalog }: Props) {
  return (
    <div className="dd-entity-hint" role="note">
      <div className="flex gap-2">
        <Info className="mt-0.5 size-3.5 shrink-0 opacity-80" aria-hidden />
        <p>{catalog ? DD_CATALOG_ASSIGNMENTS_HINT : DD_SHARED_ASSIGNMENTS_HINT}</p>
      </div>
    </div>
  );
}
