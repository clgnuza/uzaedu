'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';

/** Bildirim sistemi zaten var (/bildirimler). Destek modülünde küçük bir hatırlatma. */
export function SupportNotificationHint() {
  return (
    <Link
      href="/bildirimler"
      className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-muted/30 px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
    >
      <Bell className="size-3.5" />
      <span>Destek bildirimleri</span>
    </Link>
  );
}
