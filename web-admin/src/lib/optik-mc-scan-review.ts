import type { OmrScanLayout } from '@/lib/optik-api';
import { isCurrentOmrLayout } from '@/lib/optik-omr-layout-constants';
import {
  decodeOmrBurstEnhanced,
  decodeOmrPreviewFromBase64,
  type OmrDecodeMode,
  type OmrDecodeResult,
  type OmrLivePreview,
} from '@/lib/optik-omr-decode';
import { assessOmrImageQuality } from '@/lib/optik-omr-quality';
import { answerKeyToNumberMap } from '@/lib/optik-omr-overlay';

export type McScanReviewPayload = {
  previewB64: string;
  decoded: OmrDecodeResult;
  preview: OmrLivePreview | null;
  ambiguous: number[];
  maxQuestion: number;
  choiceCount: number;
  answerKey?: Record<number, string>;
  quality: { blurScore: number; brightness: number };
};

export async function buildMcScanReview(
  frames: string[],
  layout: OmrScanLayout,
  opts: { maxQuestion: number; choiceCount: number; mode?: OmrDecodeMode },
  answerKeyRaw?: Record<string, string> | Record<number, string>,
): Promise<McScanReviewPayload> {
  const list = frames.length > 0 ? frames : [];
  if (list.length === 0) throw new Error('Kare yok');
  if (!isCurrentOmrLayout(layout)) {
    throw new Error('Eski form düzeni (omr-v3). Optik Formlar’dan yeni PDF indirin.');
  }

  const quality = await assessOmrImageQuality(list[0]!);
  if (!quality.ok) throw new Error(quality.message ?? 'Görüntü kalitesi yetersiz');

  const { result, previewFrame } = await decodeOmrBurstEnhanced(list, layout, {
    maxQuestion: opts.maxQuestion,
    mode: opts.mode ?? 'student',
  });

  const preview = await decodeOmrPreviewFromBase64(previewFrame, layout, {
    maxQuestion: opts.maxQuestion,
    mode: opts.mode ?? 'student',
  });

  const answerKey = answerKeyRaw ? answerKeyToNumberMap(answerKeyRaw) : undefined;
  const ambiguous = result.perQuestion.filter((p) => p.ambiguous).map((p) => p.question);

  return {
    previewB64: previewFrame,
    decoded: result,
    preview,
    ambiguous,
    maxQuestion: opts.maxQuestion,
    choiceCount: opts.choiceCount,
    answerKey: answerKey && Object.keys(answerKey).length > 0 ? answerKey : undefined,
    quality: { blurScore: quality.blurScore, brightness: quality.brightness },
  };
}

export function reviewHasBlockingAmbiguous(review: McScanReviewPayload): boolean {
  return review.ambiguous.length > 0;
}

export function applyReviewAnswer(
  review: McScanReviewPayload,
  question: number,
  label: string,
): McScanReviewPayload {
  const ambiguous = review.ambiguous.filter((q) => q !== question);
  const answers = { ...review.decoded.answers, [question]: label };
  const perQuestion = review.decoded.perQuestion.map((p) =>
    p.question === question ? { ...p, label, ambiguous: false, fill: 1 } : p,
  );
  return {
    ...review,
    ambiguous,
    decoded: { ...review.decoded, answers, perQuestion },
  };
}
