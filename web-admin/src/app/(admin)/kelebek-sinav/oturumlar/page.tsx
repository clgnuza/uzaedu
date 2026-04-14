'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

/** Eski rota — `school_id` vb. sorgu korunur. */
export default function KelebekOturumlarRedirectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  useEffect(() => {
    const q = searchParams.toString();
    router.replace(q ? `/kelebek-sinav/sinav-islemleri?${q}` : '/kelebek-sinav/sinav-islemleri');
  }, [router, searchParams]);
  return (
    <div className="flex justify-center py-16">
      <LoadingSpinner />
    </div>
  );
}
