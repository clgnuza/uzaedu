'use client';

import { YillikPlanTeacherWizard } from '@/components/yillik-plan/yillik-plan-teacher-wizard';

export default function BilsemYillikPlanPage() {
  return (
    <div className="min-h-[min(52vh,18rem)] px-2 pb-3 pt-0.5 sm:min-h-[min(70vh,28rem)] sm:px-0 sm:pb-0 sm:pt-0">
      <YillikPlanTeacherWizard scope="bilsem" hideHeader />
    </div>
  );
}
