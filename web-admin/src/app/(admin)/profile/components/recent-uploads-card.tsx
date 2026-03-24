'use client';

import Link from 'next/link';
import { FileText, FileSpreadsheet, Image, File } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

const UPLOADS = [
  { icon: FileText, name: 'Ders-planı-2024.pdf', meta: '1.2 MB · 15 Oca 2025' },
  { icon: FileSpreadsheet, name: 'Not-listesi.xlsx', meta: '0.8 MB · 10 Oca 2025' },
  { icon: Image, name: 'Sunum-slayt.png', meta: '2.1 MB · 5 Oca 2025' },
  { icon: File, name: 'Ödev-şablonu.docx', meta: '0.3 MB · 1 Oca 2025' },
];

export function RecentUploadsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Son yüklemeler</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          {UPLOADS.map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="flex items-center justify-center size-9 rounded-lg bg-muted">
                <item.icon className="size-4 text-muted-foreground" />
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-sm font-medium text-foreground truncate">{item.name}</span>
                <span className="text-xs text-muted-foreground">{item.meta}</span>
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
          Tüm dosyalar
        </Link>
      </CardFooter>
    </Card>
  );
}
