'use client';

import dynamic from 'next/dynamic';

export const SealHubClient = dynamic(
  () => import('./seal-hub').then((m) => ({ default: m.SealHub })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full min-w-0 max-w-[100vw]" aria-hidden>
        <div className="landing-seal-hub relative isolate mx-auto aspect-square w-full min-h-0 max-w-[min(94vw,380px)] animate-pulse rounded-full bg-zinc-900/35 sm:max-w-[min(94vw,520px)] md:max-w-[min(92vw,560px)] lg:max-w-[min(90vw,640px)] xl:max-w-[min(88vw,720px)]" />
      </div>
    ),
  },
);
