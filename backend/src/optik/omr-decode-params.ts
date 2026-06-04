/** OMR şık seçim eşikleri — Python `optik-omr-advanced.py` ile senkron */

export type OmrDecodeParams = {
  blank_min: number;
  margin_min: number;
  ratio_min: number;
  needs_rescan_confidence: number;
  needs_rescan_anchor: number;
};

export const DEFAULT_OMR_DECODE_PARAMS: OmrDecodeParams = {
  blank_min: 0.35,
  margin_min: 0.22,
  ratio_min: 2.0,
  needs_rescan_confidence: 0.75,
  needs_rescan_anchor: 0.8,
};

/** Sınav tipine göre daha sıkı / gevşek eşik */
export function resolveOmrDecodeParams(template: {
  examType?: string | null;
  slug?: string | null;
  choiceCount?: number;
  gradeLevel?: string | null;
}): OmrDecodeParams {
  const exam = (template.examType ?? '').toLowerCase();
  const slug = (template.slug ?? '').toLowerCase();

  if (exam.includes('lgs') || slug.includes('lgs')) {
    return {
      blank_min: 0.32,
      margin_min: 0.2,
      ratio_min: 2.1,
      needs_rescan_confidence: 0.78,
      needs_rescan_anchor: 0.82,
    };
  }

  if (exam.includes('tyt') || exam.includes('ayt') || slug.includes('tyt') || slug.includes('ayt')) {
    return {
      blank_min: 0.33,
      margin_min: 0.21,
      ratio_min: 2.05,
      needs_rescan_confidence: 0.76,
      needs_rescan_anchor: 0.81,
    };
  }

  const choices = template.choiceCount ?? 5;
  if (choices >= 6) {
    return {
      ...DEFAULT_OMR_DECODE_PARAMS,
      margin_min: 0.2,
      ratio_min: 2.15,
    };
  }

  return { ...DEFAULT_OMR_DECODE_PARAMS };
}
