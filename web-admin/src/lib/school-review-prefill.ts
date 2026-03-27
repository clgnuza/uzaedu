export type SchoolReviewFormState = {
  rating: number;
  comment: string;
  criteria_ratings: Record<string, number>;
  is_anonymous: boolean;
};

export function emptySchoolReviewForm(): SchoolReviewFormState {
  return { rating: 0, comment: '', criteria_ratings: {}, is_anonymous: false };
}

/** Mevcut değerlendirme kaydından form durumu (üst form / düzenleme). */
export function schoolReviewFormFromReview(
  r: {
    rating: number;
    criteria_ratings: Record<string, number> | null;
    comment: string | null;
    is_anonymous: boolean;
  },
  criteria: { slug: string }[],
): SchoolReviewFormState {
  const initialCriteria: Record<string, number> = {};
  if (r.criteria_ratings) Object.assign(initialCriteria, r.criteria_ratings);
  for (const c of criteria) {
    if (initialCriteria[c.slug] == null) initialCriteria[c.slug] = r.criteria_ratings?.[c.slug] ?? 0;
  }
  return {
    rating: r.rating,
    comment: r.comment || '',
    criteria_ratings: initialCriteria,
    is_anonymous: r.is_anonymous,
  };
}
