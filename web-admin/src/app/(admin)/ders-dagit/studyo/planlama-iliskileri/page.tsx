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
        description="Ders ve sınıfa özel planlama ilişkileri; okul kurallarıyla uyumlu ekleme."
      />
      <PlanningRelationsPanel />
    </div>
  );
}
