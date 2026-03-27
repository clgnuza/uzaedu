import { Suspense } from 'react';
import { cn } from '@/lib/utils';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { TvRootShell } from '../tv-layout-shell';
import TvAudienceContent from './tv-audience-view';

type PageProps = {
  searchParams: Promise<{ preview?: string | string[] }>;
};

function TvLoadingFallback({ isPreview }: { isPreview: boolean }) {
  return (
    <div
      className={cn(
        'flex w-full items-center justify-center bg-[#0c1929]',
        isPreview ? 'min-h-0 flex-1' : 'min-h-screen',
      )}
    >
      <LoadingSpinner label="Duyuru TV yükleniyor…" />
    </div>
  );
}

export default async function TvAudiencePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const raw = sp.preview;
  const isPreview = raw === '1' || (Array.isArray(raw) && raw[0] === '1');

  return (
    <TvRootShell isPreview={isPreview}>
      <Suspense fallback={<TvLoadingFallback isPreview={isPreview} />}>
        <TvAudienceContent />
      </Suspense>
    </TvRootShell>
  );
}
