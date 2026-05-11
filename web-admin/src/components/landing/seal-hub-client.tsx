'use client';

import dynamic from 'next/dynamic';

export const SealHubClient = dynamic(
  () => import('./seal-hub').then((m) => ({ default: m.SealHub })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full min-w-0 max-w-[100vw]" aria-hidden>
        <div className="relative isolate mx-auto aspect-square w-full min-h-0 max-w-[min(94vw,440px)] animate-pulse rounded-full bg-zinc-900/35 sm:max-w-[min(92vw,500px)] md:max-w-[min(90vw,540px)] lg:max-w-[min(88vw,620px)] xl:max-w-[min(84vw,700px)]" />
      </div>
    ),
  },
);
