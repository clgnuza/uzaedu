'use client';

import { useEffect, useState } from 'react';
import { UzaeduAppIcon } from '@/components/brand/uzaedu-app-icon';
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
        'fixed inset-0 z-[10000] flex flex-col items-center justify-center transition-opacity duration-300',
        'bg-linear-to-b from-[#042f2e] via-[#0f172a] to-[#020617]',
        phase === 'out' ? 'pointer-events-none opacity-0' : 'opacity-100',
      )}
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_50%_28%,rgba(20,184,166,0.28),transparent)]" />
      <div className="relative">
        <div className="absolute -inset-6 rounded-full bg-teal-400/20 blur-3xl" aria-hidden />
        <UzaeduAppIcon size={112} className="relative" />
      </div>
      <p className="relative mt-6 text-xl font-bold tracking-tight text-white">Uzaedu</p>
      <p className="relative mt-1 text-sm font-medium text-slate-400">Öğretmen</p>
      <div className="relative mt-10 h-1 w-28 overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-2/5 animate-pulse rounded-full bg-linear-to-r from-teal-400 to-cyan-300" />
      </div>
    </div>
  );
}
