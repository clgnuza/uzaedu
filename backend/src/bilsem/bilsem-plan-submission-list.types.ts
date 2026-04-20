/** Liste uçları: items_json gönderilmez (özet + hafta sayısı). */
export type BilsemPlanSubmissionMineRow = {
  id: string;
  status: string;
  subjectCode: string;
  subjectLabel: string;
  anaGrup: string;
  altGrup: string | null;
  academicYear: string;
  planGrade: number;
  weekCount: number;
  submittedAt: string | null;
  updatedAt: string;
  createdAt: string;
};

export type BilsemPlanSubmissionModerationQueueRow = BilsemPlanSubmissionMineRow & {
  authorUserId: string;
  authorEmail: string | null;
  authorDisplayName: string | null;
};
