'use client';

import { YillikPlanTeacherWizard } from '@/components/yillik-plan/yillik-plan-teacher-wizard';

export default function BilsemYillikPlanPage() {
  return (
    <div className="min-h-[min(58vh,20rem)] px-1.5 pb-3 sm:min-h-[min(70vh,28rem)] sm:px-0 sm:pb-0">
      <YillikPlanTeacherWizard scope="bilsem" hideHeader />
    </div>
  );
}
