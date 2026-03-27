'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const tab = searchParams.get('tab');
    router.replace(tab ? `/profile?tab=${tab}` : '/profile');
  }, [router, searchParams]);

  return null;
}
