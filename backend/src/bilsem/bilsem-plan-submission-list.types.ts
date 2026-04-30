/** Liste uçları: items_json gönderilmez (özet + hafta sayısı). */
export type BilsemPlanSubmissionMineRow = {
  id: string;
  status: string;
  subjectCode: string;
  subjectLabel: string;
  anaGrup: string;
  altGrup: string | null;
  academicYear: string;
  planGrade: number | null;
  weekCount: number;
  /** İncelemeye gönderilme */
  submittedAt: string | null;
  /** Moderasyon kararı (onay / red / geri çekme) */
  decidedAt: string | null;
  /** Kataloğa yansıtılma (yalnızca published) */
  publishedAt: string | null;
  /** Yayınlandıysa Word üretim başına jeton oranı */
  rewardJetonPerGeneration: string | null;
  updatedAt: string;
  createdAt: string;
};

export type BilsemModerationHistoryRow = BilsemPlanSubmissionMineRow & {
  authorUserId: string;
  authorEmail: string | null;
  authorDisplayName: string | null;
  reviewerUserId: string | null;
  reviewerLabel: string | null;
};

export type BilsemPlanAuthorSummary = {
  counts: {
    draft: number;
    pending_review: number;
    published: number;
    rejected: number;
    withdrawn: number;
  };
  /** Başka öğretmenlerin bu planı Word üretiminde kullanması (ledger satırı) */
  planWordUsageCount: number;
  /** Kredilenen toplam jeton (ledger toplamı) */
  totalJetonCredited: string;
  bySubmission: Array<{
    submissionId: string;
    usageCount: number;
    totalJeton: string;
  }>;
};

export type BilsemModerationDashboard = {
  pending: number;
  published: number;
  rejected: number;
  withdrawn: number;
};

export type BilsemPlanSubmissionModerationQueueRow = BilsemPlanSubmissionMineRow & {
  authorUserId: string;
  authorEmail: string | null;
  authorDisplayName: string | null;
};

/** Katalog / hafta uyumu; yayın öncesi moderasyonda gösterilir. */
export type BilsemModerationValidationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  catalogMatch: boolean;
};
