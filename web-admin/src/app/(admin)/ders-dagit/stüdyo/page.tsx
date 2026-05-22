'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function StudioIndex() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/ders-dagit/stüdyo/kurulum');
  }, [router]);
  return null;
}
