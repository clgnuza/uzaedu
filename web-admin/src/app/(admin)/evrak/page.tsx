'use client';

import { YillikPlanTeacherWizard } from '@/components/yillik-plan/yillik-plan-teacher-wizard';

export default function EvrakPage() {
  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl pb-24 sm:pb-0">
      <YillikPlanTeacherWizard scope="evrak" />
    </div>
  );
}
