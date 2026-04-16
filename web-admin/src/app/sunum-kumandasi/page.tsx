'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getApiUrl } from '@/lib/api';
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Presentation } from 'lucide-react';

function SunumKumandasiInner() {
  const sp = useSearchParams();
  const schoolId = sp.get('school_id') ?? '';
  const sessionId = sp.get('s') ?? '';
  const [secret, setSecret] = useState('');
  useEffect(() => {
    const raw = typeof window === 'undefined' ? '' : window.location.hash.replace(/^#/, '');
    if (!raw) return;
    const p = raw.startsWith('p=') ? raw.slice(2) : raw;
    try {
      setSecret(decodeURIComponent(p));
    } catch {
      setSecret(p);
    }
  }, []);

  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const send = useCallback(
    async (action: string) => {
      if (!schoolId || !sessionId || !secret) return;
      try {
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(12);
      } catch {
        /* ignore */
      }
      setBusy(true);
      setStatus(null);
      try {
        const res = await fetch(getApiUrl('/tv/remote/command'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ school_id: schoolId, session_id: sessionId, secret, action }),
        });
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        if (!res.ok) setStatus(typeof j.message === 'string' ? j.message : 'Gönderilemedi');
      } catch {
        setStatus('Ağ hatası');
      } finally {
        setBusy(false);
      }
    },
    [schoolId, sessionId, secret],
  );

  const ready = !!(schoolId && sessionId && secret);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-linear-to-b from-slate-950 via-violet-950/95 to-slate-950 px-4 pb-12 pt-12 text-white">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="mb-8 text-center">
          <Presentation className="mx-auto mb-3 size-12 text-violet-300/95" aria-hidden />
          <h1 className="text-2xl font-black tracking-tight">Sunum kumandası</h1>
          <p className="mt-2 text-sm text-violet-200/85">TV duyuru slaytları</p>
        </div>
        {!ready ? (
          <p className="text-center text-sm leading-relaxed text-rose-200/90">
            Geçersiz veya eksik bağlantı. Tahtadaki TV’de «Telefon kumandası»nı açıp QR veya linki yeniden alın.
          </p>
        ) : (
          <>
            {status ? <p className="mb-4 text-center text-sm text-amber-300">{status}</p> : null}
            <div className="flex flex-1 flex-col items-center justify-center gap-10 py-6">
              <div className="flex w-full max-w-sm items-stretch justify-between gap-4 px-1">
                <button
                  type="button"
                  disabled={busy}
                  className="flex min-h-[8.5rem] flex-1 flex-col items-center justify-center rounded-3xl border-4 border-white/20 bg-white/10 py-4 shadow-xl transition active:scale-[0.97] disabled:opacity-45"
                  onClick={() => void send('prev')}
                  aria-label="Önceki slayt"
                >
                  <ChevronLeft className="size-14 shrink-0 sm:size-16" strokeWidth={2.5} />
                  <span className="mt-2 text-xs font-bold uppercase tracking-widest text-white/65">Önceki</span>
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="flex min-h-[8.5rem] flex-1 flex-col items-center justify-center rounded-3xl border-4 border-violet-400/50 bg-violet-600/85 py-4 shadow-xl transition active:scale-[0.97] disabled:opacity-45"
                  onClick={() => void send('next')}
                  aria-label="Sonraki slayt"
                >
                  <ChevronRight className="size-14 shrink-0 sm:size-16" strokeWidth={2.5} />
                  <span className="mt-2 text-xs font-bold uppercase tracking-widest text-white/80">Sonraki</span>
                </button>
              </div>
              <div className="flex w-full max-w-sm justify-center gap-4">
                <button
                  type="button"
                  disabled={busy}
                  className="flex h-16 flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-white/20 bg-black/25 text-sm font-bold text-white/90 transition active:scale-[0.98] disabled:opacity-45"
                  onClick={() => void send('first')}
                >
                  <ChevronFirst className="size-6" />
                  İlk
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="flex h-16 flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-white/20 bg-black/25 text-sm font-bold text-white/90 transition active:scale-[0.98] disabled:opacity-45"
                  onClick={() => void send('last')}
                >
                  Son
                  <ChevronLast className="size-6" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function SunumKumandasiPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center bg-slate-950 text-sm text-white/80">Yükleniyor…</div>
      }
    >
      <SunumKumandasiInner />
    </Suspense>
  );
}
