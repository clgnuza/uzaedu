'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { saveShareFiles } from '@/lib/pwa-share-intake';
import { trackPwaEvent } from '@/lib/pwa-analytics';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

type LaunchQueue = {
  setConsumer: (cb: (params: { files: FileSystemFileHandle[] }) => void) => void;
};

export default function PwaDosyaPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      router.replace(`/login/ogretmen?redirect=${encodeURIComponent('/pwa/dosya')}`);
      return;
    }

    const lq = (window as Window & { launchQueue?: LaunchQueue }).launchQueue;
    if (!lq?.setConsumer) {
      setError('Bu cihaz dosya ile açmayı desteklemiyor. Dosyayı paylaş menüsünden gönderin.');
      return;
    }

    lq.setConsumer((params) => {
      void (async () => {
        try {
          const files = await Promise.all(params.files.map((h) => h.getFile()));
          await saveShareFiles(files);
          trackPwaEvent('pwa_file_handler', { count: files.length });
          router.replace('/pwa/gelen?source=file');
        } catch {
          setError('Dosyalar okunamadı.');
        }
      })();
    });
  }, [token, router]);

  return (
    <main className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-6 text-center">
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <>
          <LoadingSpinner className="size-8 text-teal-600" />
          <p className="text-sm text-muted-foreground">Dosya alınıyor…</p>
        </>
      )}
    </main>
  );
}
