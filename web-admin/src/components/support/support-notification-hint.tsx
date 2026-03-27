'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';

/** Bildirim sistemi zaten var (/bildirimler). Destek modülünde küçük bir hatırlatma. */
export function SupportNotificationHint() {
  return (
    <Link
      href="/bildirimler"
      className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-2 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:text-foreground"
    >
      <Bell className="size-3.5" />
      <span>Destek bildirimleri</span>
    </Link>
  );
}
