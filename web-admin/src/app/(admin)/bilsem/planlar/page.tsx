'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Eski /bilsem/planlar bağlantıları takvime yönlendirilir */
export default function BilsemPlanlarRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/bilsem/takvim');
  }, [router]);
  return null;
}
