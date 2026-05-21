'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  applyReviewAnswer,
  reviewHasBlockingAmbiguous,
  type McScanReviewPayload,
} from '@/lib/optik-mc-scan-review';
import { computeOverlayStats } from '@/lib/optik-omr-overlay';
import { OptikOmrPreviewOverlay } from './OptikOmrPreviewOverlay';
import { AlertTriangle, Check, RotateCcw, X } from 'lucide-react';

const CHOICES = ['A', 'B', 'C', 'D', 'E', 'F'];

export function OptikMcScanReviewDialog({
  open,
  review,
  onClose,
  onRetry,
  onConfirm,
}: {
  open: boolean;
  review: McScanReviewPayload | null;
  onClose: () => void;
  onRetry: () => void;
  onConfirm: (review: McScanReviewPayload) => void;
}) {
  const [local, setLocal] = useState<McScanReviewPayload | null>(review);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLocal(review);
  }, [review]);

  const data = local ?? review;
  if (!open || !data) return null;

  const showGrade = !!data.answerKey && Object.keys(data.answerKey).length > 0;
  const stats = showGrade
    ? computeOverlayStats(data.decoded.answers, data.answerKey!, data.maxQuestion)
    : null;
  const blocking = reviewHasBlockingAmbiguous(data);
  const answered = Object.keys(data.decoded.answers).length;
  const engine = data.decoded.warp_engine ?? 'none';
  const engineLabel =
    engine === 'opencv' ? 'OpenCV' : engine === 'legacy' ? 'Yerel' : 'Hizasız';

  const setAnswer = useCallback((q: number, label: string) => {
    setLocal((prev) => (prev ? applyReviewAnswer(prev, q, label) : prev));
  }, []);

  const imgSrc = data.previewB64.startsWith('data:')
    ? data.previewB64
    : `data:image/jpeg;base64,${data.previewB64}`;

  const maxChoice = Math.min(6, Math.max(4, data.choiceCount));
  const labels = CHOICES.slice(0, maxChoice);

  return createPortal(
    <div className="fixed inset-0 z-[210] flex flex-col bg-zinc-950 text-white">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2.5">
        <div>
          <p className="text-sm font-bold">Ön izleme</p>
          <p className="text-[11px] text-white/70">
            {answered} soru · %{Math.round((data.decoded.confidence ?? 0) * 100)} güven · {engineLabel}
            {data.decoded.anchor_score != null
              ? ` · köşe %${Math.round(data.decoded.anchor_score * 100)}`
              : ''}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 text-white"
          onClick={onClose}
        >
          <X className="size-5" />
        </Button>
      </div>

      <div ref={wrapRef} className="relative max-h-[42vh] min-h-[200px] flex-1 bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={imgSrc}
          alt="Tarama önizleme"
          className="h-full w-full object-contain"
        />
        {data.preview ? (
          <OptikOmrPreviewOverlay
            imgRef={imgRef}
            containerRef={wrapRef}
            preview={data.preview}
            answerKey={data.answerKey}
            maxQuestion={data.maxQuestion}
            showGrade={showGrade}
          />
        ) : null}
      </div>

      {stats ? (
        <p className="bg-black/60 py-1.5 text-center text-xs font-semibold tabular-nums">
          D: {stats.dogru} · Y: {stats.yanlis} · B: {stats.bos}
        </p>
      ) : null}

      {blocking ? (
        <p className="flex items-center justify-center gap-1.5 bg-amber-500/20 px-3 py-2 text-xs text-amber-100">
          <AlertTriangle className="size-3.5 shrink-0" />
          {data.ambiguous.length} belirsiz soru — şık seçin veya yeniden tarayın
        </p>
      ) : null}

      <div className="max-h-[34vh] overflow-y-auto border-t border-white/10 p-2">
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
          {Array.from({ length: data.maxQuestion }, (_, i) => i + 1).map((q) => {
            const amb = data.ambiguous.includes(q);
            const cur = data.decoded.answers[q] ?? '';
            return (
              <div
                key={q}
                className={cn(
                  'rounded-lg border p-1.5',
                  amb ? 'border-amber-400/60 bg-amber-500/15' : 'border-white/15 bg-white/5',
                )}
              >
                <p className="mb-1 text-center text-[10px] font-bold text-white/80">{q}</p>
                <div className="flex flex-wrap justify-center gap-0.5">
                  {labels.map((lbl) => (
                    <button
                      key={lbl}
                      type="button"
                      className={cn(
                        'size-7 rounded-md text-xs font-bold',
                        cur === lbl
                          ? 'bg-fuchsia-600 text-white'
                          : 'bg-white/10 text-white/80 hover:bg-white/20',
                      )}
                      onClick={() => setAnswer(q, lbl)}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2 border-t border-white/10 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button type="button" variant="outline" className="flex-1 gap-1 border-white/25 text-white" onClick={onRetry}>
          <RotateCcw className="size-4" />
          Yeniden tara
        </Button>
        <Button
          type="button"
          className="flex-1 gap-1 bg-emerald-600 hover:bg-emerald-700"
          disabled={blocking}
          onClick={() => onConfirm(local ?? data)}
        >
          <Check className="size-4" />
          Kaydet
        </Button>
      </div>
    </div>,
    document.body,
  );
}
