'use client';

import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

interface WorkItem {
  title?: string;
  desc?: string;
  date?: string;
  heading?: string;
}

const SAMPLE_ITEMS: WorkItem[] = [
  { title: 'ÖğretmenPro', desc: 'Okul Yöneticisi / Öğretmen', date: '2024 - Günümüz' },
  { heading: 'Önceki görevler' },
  { title: 'Örnek Okul', desc: 'Öğretmen', date: '2020 - 2024' },
  { title: 'Eğitim Kurumu', desc: 'Stajyer', date: '2018 - 2020' },
];

export function WorkExperienceCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>İş deneyimi</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-y-5">
          {SAMPLE_ITEMS.map((item, i) =>
            item.heading ? (
              <div key={i} className="text-sm font-semibold text-muted-foreground">
                {item.heading}
              </div>
            ) : (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col gap-1">
                  {item.title && (
                    <Link href="#" className="text-sm font-medium text-primary hover:underline">
                      {item.title}
                    </Link>
                  )}
                  {item.desc && <span className="text-sm text-foreground">{item.desc}</span>}
                  {item.date && (
                    <span className="text-xs text-muted-foreground">{item.date}</span>
                  )}
                </div>
              </div>
            ),
          )}
        </div>
      </CardContent>
      <CardFooter className="justify-center">
        <Link
          href="#"
          className="text-sm font-medium text-primary hover:underline underline-offset-2"
        >
          Tüm deneyim
        </Link>
      </CardFooter>
    </Card>
  );
}
