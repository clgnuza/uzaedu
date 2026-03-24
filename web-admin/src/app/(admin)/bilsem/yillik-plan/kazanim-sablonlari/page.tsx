'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Eski menü yolu → BİLSEM altyapısı, Yıllık Plan İçerikleri sekmesi */
export default function KazanimSablonlariRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/bilsem-sablon?tab=yillik-plan');
  }, [router]);
  return null;
}
