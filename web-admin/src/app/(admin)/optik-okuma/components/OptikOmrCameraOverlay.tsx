'use client';

import { useEffect, useRef } from 'react';
import type { OmrLivePreview } from '@/lib/optik-omr-decode';
import {
  OVERLAY_COLORS,
  computeOverlayStats,
  mapBubbleToContainer,
  resolveBubbleOverlayKind,
  type OmrOverlayStats,
} from '@/lib/optik-omr-overlay';

export function OptikOmrCameraOverlay({
  videoRef,
  containerRef,
  preview,
  answerKey,
  maxQuestion,
  showGrade,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  preview: OmrLivePreview | null;
  answerKey?: Record<number, string>;
  maxQuestion: number;
  showGrade: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const video = videoRef.current;
    if (!canvas || !container || !preview) return;

    const draw = () => {
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      if (cw < 1 || ch < 1 || !video?.videoWidth) return;

      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
      canvas.style.width = `${cw}px`;
      canvas.style.height = `${ch}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);

      const answers = preview.result.answers;
      const ambSet = new Set(
        preview.result.perQuestion.filter((p) => p.ambiguous).map((p) => p.question),
      );
      const key = showGrade && answerKey ? answerKey : undefined;

      for (const b of preview.bubbles) {
        if (b.question > maxQuestion) continue;
        const { x, y, radius } = mapBubbleToContainer(
          b,
          preview.quad,
          video.videoWidth,
          video.videoHeight,
          cw,
          ch,
        );
        const kind = resolveBubbleOverlayKind(
          b.label,
          b.mark,
          answers[b.question],
          key?.[b.question],
          ambSet.has(b.question),
        );
        const colors = OVERLAY_COLORS[kind];
        if (kind === 'empty') continue;

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = colors.fill;
        ctx.fill();
        ctx.lineWidth = kind === 'key' ? 2 : 2.5;
        ctx.strokeStyle = colors.stroke;
        ctx.stroke();

        if (kind === 'correct') {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x - radius * 0.35, y);
          ctx.lineTo(x - radius * 0.05, y + radius * 0.3);
          ctx.lineTo(x + radius * 0.4, y - radius * 0.35);
          ctx.stroke();
        } else if (kind === 'wrong') {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x - radius * 0.3, y - radius * 0.3);
          ctx.lineTo(x + radius * 0.3, y + radius * 0.3);
          ctx.moveTo(x + radius * 0.3, y - radius * 0.3);
          ctx.lineTo(x - radius * 0.3, y + radius * 0.3);
          ctx.stroke();
        }
      }
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(container);
    return () => ro.disconnect();
  }, [preview, answerKey, maxQuestion, showGrade, videoRef, containerRef]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-10 h-full w-full"
      aria-hidden
    />
  );
}

export function OptikOmrOverlayLegend({
  showGrade,
  stats,
}: {
  showGrade: boolean;
  stats: OmrOverlayStats | null;
}) {
  return (
    <div className="pointer-events-none absolute bottom-20 left-0 right-0 z-20 flex flex-col items-center gap-1.5 px-3">
      {showGrade && stats ? (
        <p className="rounded-full bg-black/65 px-3 py-1 text-[11px] font-semibold tabular-nums text-white">
          D: {stats.dogru} · Y: {stats.yanlis} · B: {stats.bos}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-center gap-2 rounded-full bg-black/55 px-3 py-1.5 text-[10px] text-white/90">
        {showGrade ? (
          <>
            <span className="flex items-center gap-1">
              <span className="inline-block size-2.5 rounded-full bg-emerald-500" />
              Doğru
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block size-2.5 rounded-full bg-red-500" />
              Yanlış
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block size-2.5 rounded-full border border-emerald-400/80 bg-emerald-500/25" />
              Anahtar
            </span>
          </>
        ) : (
          <>
            <span className="flex items-center gap-1">
              <span className="inline-block size-2.5 rounded-full bg-sky-400" />
              İşaret
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block size-2.5 rounded-full bg-amber-400" />
              Belirsiz
            </span>
          </>
        )}
      </div>
    </div>
  );
}

export function buildOverlayStats(
  preview: OmrLivePreview | null,
  answerKey: Record<number, string> | undefined,
  maxQuestion: number,
): OmrOverlayStats | null {
  if (!preview || !answerKey || Object.keys(answerKey).length === 0) return null;
  return computeOverlayStats(preview.result.answers, answerKey, maxQuestion);
}
