import Link from 'next/link';
import { WifiOff } from 'lucide-react';
import { OfflineRetryButton } from './offline-retry-button';

export default function OfflinePage() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <WifiOff className="size-12 text-muted-foreground" aria-hidden />
      <h1 className="text-lg font-semibold">Çevrimdışısınız</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Bağlantı yokken yalnızca önbelleğe alınmış sayfalar açılabilir. Veriler sunucuya bağlanınca güncellenir.
      </p>
      <OfflineRetryButton />
      <Link href="/dashboard" className="text-sm text-primary hover:underline">
        Panele dön
      </Link>
    </main>
  );
}
