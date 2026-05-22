'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OgretmenProgramRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/ders-dagit/stüdyo/program?view=teacher');
  }, [router]);
  return null;
}
