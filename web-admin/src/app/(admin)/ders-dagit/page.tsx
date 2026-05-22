'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DersDagitIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/ders-dagit/stüdyo');
  }, [router]);
  return null;
}
