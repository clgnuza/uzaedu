'use client';

import { Layers } from 'lucide-react';
import { DistributionPolicyForm } from '@/components/ders-dagit/distribution-policy-form';
import { DdCard, CardContent, CardHeader, CardTitle } from '@/components/ders-dagit/dd-ui';
import type { DistributionPolicyDto } from '@/lib/distribution-policy';

export function DistributionPolicyCard({
  policy,
  onSave,
}: {
  policy: DistributionPolicyDto | null;
  onSave: (dto: DistributionPolicyDto) => Promise<void>;
}) {
  return (
    <DdCard variant="violet">
      <CardHeader className="space-y-1 p-3 pb-2">
        <div className="flex items-center gap-2">
          <span className="dd-icon-badge !size-8 !rounded-lg">
            <Layers className="size-4" aria-hidden />
          </span>
          <div>
            <CardTitle className="text-base">Haftalık dağıtım algoritması</CardTitle>
            <p className="text-[11px] text-muted-foreground">
              Tüm okul için varsayılan gün deseni ve üretim önceliği — atama kartındaki haftalık dağılım bunu tamamlar.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        <DistributionPolicyForm initial={policy} onSave={onSave} />
      </CardContent>
    </DdCard>
  );
}
