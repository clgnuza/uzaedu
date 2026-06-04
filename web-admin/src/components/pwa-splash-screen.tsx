'use client';

import { useEffect, useState } from 'react';
import { isPwaDisplayMode } from '@/lib/pwa-display';
import { cn } from '@/lib/utils';

const MIN_MS = 420;

export function PwaSplashScreen() {
  const [phase, setPhase] = useState<'hidden' | 'show' | 'out'>('hidden');

  useEffect(() => {
    if (!isPwaDisplayMode()) return;
    setPhase('show');
    let minDone = false;
    let loadDone = document.readyState === 'complete';

    const tryHide = () => {
      if (!minDone || !loadDone) return;
      setPhase('out');
      window.setTimeout(() => setPhase('hidden'), 280);
    };

    const tMin = window.setTimeout(() => {
      minDone = true;
      tryHide();
    }, MIN_MS);

    const onLoad = () => {
      loadDone = true;
      tryHide();
    };
    if (!loadDone) window.addEventListener('load', onLoad, { once: true });
    else tryHide();

    return () => {
      clearTimeout(tMin);
      window.removeEventListener('load', onLoad);
    };
  }, []);

  if (phase === 'hidden') return null;

  return (
    <div
      role="presentation"
      aria-hidden
      className={cn(
        'fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-[#0f172a] transition-opacity duration-300',
        phase === 'out' ? 'pointer-events-none opacity-0' : 'opacity-100',
      )}
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/pwa/icon-maskable-512.png"
        alt=""
        width={120}
        height={120}
        className="size-[7.5rem] rounded-[1.35rem] shadow-2xl shadow-teal-500/20"
        onError={(e) => {
          (e.target as HTMLImageElement).src = '/icon-512.png';
        }}
      />
      <p className="mt-5 text-lg font-semibold tracking-tight text-white">Uzaedu</p>
      <p className="mt-1 text-sm text-white/55">Öğretmen</p>
      <div className="mt-8 h-1 w-24 overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-teal-400/80" />
      </div>
    </div>
  );
}
