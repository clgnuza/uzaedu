'use client';

import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { MoreHorizontal } from 'lucide-react';

const PROJECTS = [
  { name: '2024-2025 Dönem Planı', progress: 80, due: '15 Şub 2025', people: ['A', 'B', 'C'] },
  { name: 'Veli toplantı hazırlığı', progress: 100, due: '10 Şub 2025', people: ['M', 'F'] },
  { name: 'Sınav programı', progress: 45, due: '1 Mar 2025', people: ['Z'] },
  { name: 'Ders materyalleri', progress: 60, due: '20 Şub 2025', people: ['A', 'K'] },
  { name: 'Proje sunumları', progress: 25, due: '5 Mar 2025', people: ['F', 'M', 'Z'] },
];

export function ProjectsTableCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Projeler / görevler</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="table-x-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground min-w-[180px]">
                  Proje / Görev
                </th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground min-w-[120px]">
                  İlerleme
                </th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground min-w-[80px]">
                  Kişi
                </th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground min-w-[100px]">
                  Bitiş
                </th>
                <th className="w-10 py-3 px-2" />
              </tr>
            </thead>
            <tbody>
              {PROJECTS.map((row, i) => (
                <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="py-3 px-4">
                    <Link href="#" className="font-medium text-foreground hover:text-primary hover:underline">
                      {row.name}
                    </Link>
                  </td>
                  <td className="py-3 px-4">
                    <div className="h-1.5 w-full max-w-[100px] rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${row.progress}%` }}
                      />
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex justify-end gap-0.5">
                      {row.people.slice(0, 3).map((p, j) => (
                        <span
                          key={j}
                          className="flex size-6 items-center justify-center rounded-full bg-primary/15 text-xs font-medium text-primary ring-2 ring-background"
                        >
                          {p}
                        </span>
                      ))}
                      {row.people.length > 3 && (
                        <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground ring-2 ring-background">
                          +{row.people.length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right text-muted-foreground">{row.due}</td>
                  <td className="py-3 px-2">
                    <button
                      type="button"
                      className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <MoreHorizontal className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
      <CardFooter className="justify-center">
        <Link
          href="#"
          className="text-sm font-medium text-primary hover:underline underline-offset-2"
        >
          Tüm projeler
        </Link>
      </CardFooter>
    </Card>
  );
}
