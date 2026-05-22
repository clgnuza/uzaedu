'use client';

import { DdPageHeader, DD_PAGE } from '@/components/ders-dagit/dd-ui';
import { PlanningRelationsPanel } from '@/components/ders-dagit/planning-relations-panel';
import { GitBranch } from 'lucide-react';

export default function PlanlamaIliskileriPage() {
  return (
    <div className={DD_PAGE}>
      <DdPageHeader
        icon={GitBranch}
        title="Planlama ilişkileri"
        description="Ders–sınıf kapsamı ve basit / gelişmiş kart ilişkileri (aSc planlama ilişkileri)."
      />
      <PlanningRelationsPanel />
    </div>
  );
}
