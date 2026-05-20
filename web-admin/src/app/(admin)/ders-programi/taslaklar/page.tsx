'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

/** Eski URL; Programlarım → Taslaklar sekmesine yönlendirir. */
export default function TaslaklarPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/ders-programi/programlarim?tab=drafts');
  }, [router]);

  return (
    <div className="flex justify-center py-16">
      <LoadingSpinner className="size-8" />
    </div>
  );
}
