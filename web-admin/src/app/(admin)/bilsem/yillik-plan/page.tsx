'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { YillikPlanTeacherWizard } from '@/components/yillik-plan/yillik-plan-teacher-wizard';

export default function BilsemYillikPlanPage() {
  const pathname = usePathname();
  const isPlanTab = pathname === '/bilsem/yillik-plan';
  return (
    <div className="min-h-[min(45vh,14rem)] px-0.5 pb-1 pt-0 sm:min-h-[min(70vh,28rem)] sm:px-0 sm:pb-0 sm:pt-0">
      <div className="mb-3 flex items-center gap-2">
        <Link
          href="/bilsem/yillik-plan"
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${isPlanTab ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-muted/80'}`}
        >
          Word plan
        </Link>
        <Link
          href="/bilsem/yillik-plan/kazanim-sablonlari"
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${!isPlanTab ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-muted/80'}`}
        >
          Kazanim setleri
        </Link>
      </div>
      <YillikPlanTeacherWizard scope="bilsem" hideHeader />
    </div>
  );
}
