'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Eski yayın sayfası → birleşik program editörü */
export default function YayinRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/ders-dagit/stüdyo/program?panel=publish');
  }, [router]);
  return <p className="text-sm text-muted-foreground">Program editörüne yönlendiriliyor…</p>;
}
