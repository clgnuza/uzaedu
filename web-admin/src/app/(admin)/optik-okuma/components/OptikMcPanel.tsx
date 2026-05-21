'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  Camera,
  Copy,
  Crosshair,
  RotateCcw,
  ScanLine,
  Target,
} from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

const CHOICES = ['A', 'B', 'C', 'D', 'E', 'F'];

export function OptikMcPanel({
  ready,
  busy,
  answers,
  ambiguous,
  confidence,
  anchorScore,
  choiceCount,
  mcBurstFrames = 3,
  onScan,
  onCopy,
  onReset,
  onSetAnswer,
}: {
  ready: boolean;
  busy: boolean;
  answers: Record<number, string>;
  ambiguous: number[];
  confidence: number | null;
  anchorScore: number | null;
  choiceCount: number;
  mcBurstFrames?: number;
  onScan: () => void;
  onCopy: () => void;
  onReset: () => void;
  onSetAnswer: (q: number, label: string) => void;
}) {
  const entries = Object.entries(answers).sort(([a], [b]) => Number(a) - Number(b));
  const maxChoice = Math.min(6, Math.max(4, choiceCount));
  const labels = CHOICES.slice(0, maxChoice);

  return (
    <section className="overflow-hidden rounded-2xl border border-fuchsia-500/20 bg-card shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-fuchsia-500/15 bg-linear-to-r from-fuchsia-500/10 via-violet-500/8 to-transparent px-2.5 py-2">
        <h2
          className="flex items-center gap-1.5 text-xs font-semibold md:text-sm"
          title="Çoktan seçmeli şık tarama"
        >
          <ScanLine className="size-4 text-fuchsia-600" />
          MC
        </h2>
        {(confidence != null || anchorScore != null) && (
          <div className="flex gap-1.5 text-[10px]">
            {confidence != null ? (
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-medium text-emerald-700 dark:text-emerald-300">
                %{Math.round(confidence * 100)} güven
              </span>
            ) : null}
            {anchorScore != null ? (
              <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 font-medium text-cyan-800 dark:text-cyan-200">
                <Crosshair className="mr-0.5 inline size-2.5" />
                köşe {Math.round(anchorScore * 100)}%
              </span>
            ) : null}
          </div>
        )}
      </div>

      <div className="space-y-3 p-3">
        <Button
          type="button"
          title={`Kamera · ${mcBurstFrames} kare`}
          className="h-11 w-full gap-2 rounded-xl bg-linear-to-r from-fuchsia-600 to-violet-600 text-sm font-semibold shadow-md shadow-fuchsia-500/20"
          disabled={!ready || busy}
          onClick={onScan}
        >
          {busy ? <LoadingSpinner className="size-5" /> : <Camera className="size-5" />}
          <span className="md:hidden">Tara</span>
          <span className="hidden md:inline">Kamera · {mcBurstFrames} kare</span>
        </Button>

        {ambiguous.length > 0 ? (
          <p
            title={`${ambiguous.length} belirsiz — şıka dokunun`}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2 py-1.5 text-[10px] text-amber-900 dark:text-amber-100"
          >
            <AlertTriangle className="size-3.5 shrink-0" />
            <span>{ambiguous.length} belirsiz</span>
          </p>
        ) : null}

        {entries.length > 0 ? (
          <>
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
              {entries.map(([q, lbl]) => {
                const n = Number(q);
                const isAmb = ambiguous.includes(n);
                return (
                  <div
                    key={q}
                    className={cn(
                      'rounded-lg border p-1.5 text-center',
                      isAmb ? 'border-amber-400/60 bg-amber-500/10' : 'border-border/70 bg-muted/30',
                    )}
                  >
                    <p className="text-[9px] font-medium text-muted-foreground">{q}</p>
                    <p className="text-sm font-bold tabular-nums">{lbl || '—'}</p>
                    <div className="mt-1 flex flex-wrap justify-center gap-0.5">
                      {labels.map((c) => (
                        <button
                          key={c}
                          type="button"
                          className={cn(
                            'size-5 rounded text-[9px] font-bold transition-colors',
                            lbl === c
                              ? 'bg-fuchsia-600 text-white'
                              : 'bg-background/80 text-muted-foreground hover:bg-fuchsia-500/20',
                          )}
                          onClick={() => onSetAnswer(n, c)}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" className="h-9 flex-1 gap-1 rounded-xl text-xs" onClick={onCopy}>
                <Copy className="size-3.5" />
                Kopyala
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-9 gap-1 rounded-xl text-xs" onClick={onReset}>
                <RotateCcw className="size-3.5" />
                Sıfırla
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-muted-foreground/25 py-8 text-center">
            <Target className="size-10 text-muted-foreground/40" />
            <p className="max-w-[220px] text-xs text-muted-foreground">
              Formu düz tutun; dört köşe karesi kadraja girsin. İlk taramanız burada görünür.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
