'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingDots } from '@/components/ui/loading-spinner';

const PAGE_PATH = '/okul-degerlendirmeleri';

export function SchoolDetailRedirect({ schoolId }: { schoolId: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(`${PAGE_PATH}?id=${schoolId}`);
  }, [router, schoolId]);
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-4">
      <LoadingDots />
      <p className="text-sm text-slate-600 dark:text-slate-400">Yönlendiriliyorsunuz…</p>
    </div>
  );
}
