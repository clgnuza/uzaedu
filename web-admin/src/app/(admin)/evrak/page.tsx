'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { YillikPlanTeacherWizard } from '@/components/yillik-plan/yillik-plan-teacher-wizard';

export default function EvrakPage() {
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab') === 'plan-katki' ? 'plan-katki' : 'olustur';
  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl pb-24 sm:pb-0">
      {tab === 'plan-katki' ? (
        <div className="mx-auto max-w-3xl">
          <Link href="/evrak/plan-katki" className="text-sm underline">Plan katkı listesine git</Link>
        </div>
      ) : (
        <YillikPlanTeacherWizard scope="evrak" />
      )}
    </div>
  );
}
