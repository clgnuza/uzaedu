'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Okul Duyuruları artık Duyuru TV sayfası içinde.
 * Eski linkler /tv'ye yönlendirilir.
 */
export default function AnnouncementsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/tv');
  }, [router]);
  return (
    <div className="flex items-center justify-center py-12">
      <p className="text-sm text-muted-foreground">Yönlendiriliyor…</p>
    </div>
  );
}
