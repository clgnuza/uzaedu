/**
 * Yalnızca PNG dışa aktarım snapshot’ında (ekran dışı); paylaşım görselinin sağ alt köşesi.
 */
export function ShareCardPngFiligran({ variant }: { variant: 'emerald' | 'violet' }) {
  const bg =
    variant === 'emerald'
      ? 'linear-gradient(145deg, #047857 0%, #0d9488 48%, #0e7490 100%)'
      : 'linear-gradient(145deg, #6d28d9 0%, #a21caf 52%, #c2410c 100%)';

  return (
    <div
      className="pointer-events-none absolute bottom-3 right-3 z-2 max-w-38 overflow-hidden rounded-xl border border-white/25 px-2.5 py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.2)]"
      style={{
        background: bg,
      }}
      aria-hidden
    >
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[6.5px] font-semibold uppercase tracking-[0.18em] text-white/80">Öğretmen Pro</p>
          <p className="mt-0.5 truncate text-[8px] font-medium text-white/50">ogretmen.pro</p>
        </div>
        <div
          className="shrink-0 rounded-md bg-white/15 px-1 py-0.5 text-[8px] font-black tabular-nums text-white/95"
          style={{ letterSpacing: '0.02em' }}
        >
          PNG
        </div>
      </div>
    </div>
  );
}
