'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function TimetableQuickLinks() {
  return (
    <div className="flex flex-wrap gap-1.5 print:hidden">
      <Button type="button" size="sm" variant="outline" asChild>
        <Link href="/ders-dagit/stüdyo/donem">Dönem / saatler</Link>
      </Button>
      <Button type="button" size="sm" variant="outline" asChild>
        <Link href="/ders-dagit/stüdyo/ogretmenler">Öğretmen müsaitlik</Link>
      </Button>
      <Button type="button" size="sm" variant="outline" asChild>
        <Link href="/ders-dagit/stüdyo/kurallar">Kurallar</Link>
      </Button>
      <Button type="button" size="sm" variant="outline" asChild>
        <Link href="/ders-dagit/stüdyo/dogrulama">Doğrulama</Link>
      </Button>
      <Button type="button" size="sm" variant="outline" asChild>
        <Link href="/ders-dagit/stüdyo/uret">Yeniden üret</Link>
      </Button>
    </div>
  );
}
