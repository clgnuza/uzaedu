'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Eski yayın sayfası → program tablosu */
export default function YayinRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/ders-dagit/studyo/program?panel=publish');
  }, [router]);
  return <p className="text-sm text-muted-foreground">Program tablosuna yönlendiriliyor…</p>;
}
