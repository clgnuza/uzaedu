'use client';

import { YillikPlanTeacherWizard } from '@/components/yillik-plan/yillik-plan-teacher-wizard';

export default function BilsemYillikPlanPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Yıllık plan</h1>
        <p className="mt-1 text-sm text-muted-foreground">Word belgesi olarak oluşturup indirebilirsiniz.</p>
      </div>

      <div className="min-h-[320px]">
        <YillikPlanTeacherWizard scope="bilsem" hideHeader />
      </div>
    </div>
  );
}
