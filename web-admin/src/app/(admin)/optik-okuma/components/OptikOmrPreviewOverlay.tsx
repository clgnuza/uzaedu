'use client';

import { useEffect, useRef } from 'react';
import type { OmrLivePreview } from '@/lib/optik-omr-decode';
import {
  OVERLAY_COLORS,
  mapBubbleToContainer,
  resolveBubbleOverlayKind,
} from '@/lib/optik-omr-overlay';

export function OptikOmrPreviewOverlay({
  imgRef,
  containerRef,
  preview,
  answerKey,
  maxQuestion,
  showGrade,
}: {
  imgRef: React.RefObject<HTMLImageElement | null>;
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
    const img = imgRef.current;
    if (!canvas || !container || !preview || !img?.naturalWidth) return;

    const draw = () => {
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      if (cw < 1 || ch < 1) return;

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
          img.naturalWidth,
          img.naturalHeight,
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
      }
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(container);
    img.addEventListener('load', draw);
    return () => {
      ro.disconnect();
      img.removeEventListener('load', draw);
    };
  }, [preview, answerKey, maxQuestion, showGrade, imgRef, containerRef]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-10 h-full w-full"
      aria-hidden
    />
  );
}
