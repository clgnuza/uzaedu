'use client';

import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

const CONTRIBUTORS = [
  { initial: 'A', name: 'Ahmet Yılmaz', count: 12 },
  { initial: 'F', name: 'Fatma Demir', count: 8 },
  { initial: 'M', name: 'Mehmet Kaya', count: 15 },
  { initial: 'Z', name: 'Zeynep Öz', count: 5 },
];

export function ContributorsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Katkıda bulunanlar</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3">
          {CONTRIBUTORS.map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {item.initial}
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-sm font-semibold text-foreground truncate">{item.name}</span>
                <span className="text-xs text-muted-foreground">{item.count} katkı</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter className="justify-center">
        <Link
          href="#"
          className="text-sm font-medium text-primary hover:underline underline-offset-2"
        >
          Tümü
        </Link>
      </CardFooter>
    </Card>
  );
}
