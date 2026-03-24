'use client';

import Link from 'next/link';
import { ShieldAlert, LayoutDashboard } from 'lucide-react';

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4">
      <div className="rounded-full bg-muted p-6">
        <ShieldAlert className="size-14 text-muted-foreground" aria-hidden />
      </div>
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Bu sayfaya erişim yetkiniz yok</h1>
        <p className="max-w-sm text-muted-foreground">
          Bu alan rolünüzle kullanıma açık değil. Ana sayfaya dönüp yetkili olduğunuz işlemlere devam edebilirsiniz.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        <LayoutDashboard className="size-4" />
        Ana sayfaya dön
      </Link>
    </div>
  );
}
