'use client';

import { Suspense } from 'react';
import { PwaShareBanner } from '@/components/pwa-share-banner';
import { usePwaOptikShare } from '@/hooks/use-pwa-optik-share';

export function OptikPwaShareBridge({
  runMcDecode,
  hasTemplate,
}: {
  runMcDecode: (input: string | string[]) => Promise<void>;
  hasTemplate: boolean;
}) {
  const { importShare } = usePwaOptikShare(runMcDecode, hasTemplate);
  return (
    <Suspense fallback={null}>
      <PwaShareBanner expect="optik" onImportOptik={importShare} />
    </Suspense>
  );
}
