'use client';

import Link from 'next/link';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Lightbulb } from 'lucide-react';

export function UnlockCard() {
  return (
    <Card>
      <CardContent className="px-6 py-6 lg:px-10 lg:py-8">
        <div className="flex flex-wrap md:flex-nowrap items-center gap-6 md:gap-10">
          <div className="flex flex-col gap-3">
            <h2 className="text-xl font-semibold text-foreground">
              Uzaedu Öğretmen ile
              <br />
              daha verimli yönetim
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Okul, ders ve duyuru yönetimini tek panelden yapın. Duyuruları yayınlayın,
              kullanıcıları yönetin ve raporları inceleyin.
            </p>
          </div>
          <div className="flex items-center justify-center size-32 shrink-0 rounded-xl bg-primary/10 text-primary">
            <Lightbulb className="size-16" />
          </div>
        </div>
      </CardContent>
      <CardFooter className="justify-center">
        <Link
          href="/dashboard"
          className="text-sm font-medium text-primary hover:underline underline-offset-2"
        >
          Panele git
        </Link>
      </CardFooter>
    </Card>
  );
}
