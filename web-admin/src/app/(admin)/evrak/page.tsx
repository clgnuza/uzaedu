'use client';

import { YillikPlanTeacherWizard } from '@/components/yillik-plan/yillik-plan-teacher-wizard';

export default function EvrakPage() {
  return (
    <div className="mx-auto w-full max-w-7xl">
      <YillikPlanTeacherWizard scope="evrak" />
    </div>
  );
}
