'use client';

import Link from 'next/link';
import { YillikPlanTeacherWizard } from '@/components/yillik-plan/yillik-plan-teacher-wizard';

export default function BilsemYillikPlanPage() {
  return (
    <div className="min-h-[min(52vh,18rem)] px-2 pb-3 pt-0.5 sm:min-h-[min(70vh,28rem)] sm:px-0 sm:pb-0 sm:pt-0">
      <div className="mb-2 flex justify-end">
        <Link
          href="/bilsem/plan-katki"
          className="text-xs font-medium text-violet-600 underline-offset-2 hover:underline dark:text-violet-400"
        >
          Plan katkısı (topluluk)
        </Link>
      </div>
      <YillikPlanTeacherWizard scope="bilsem" hideHeader />
    </div>
  );
}
