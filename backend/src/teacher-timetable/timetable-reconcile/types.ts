/** Ham XLS hücresi — henüz normalize edilmedi. */
export interface XlsRawCellRecord {
  sheet: string;
  row: number;
  column: string;
  column_index: number;
  day: string | null;
  slot: number | null;
  time: string | null;
  raw_text: string;
  merge_id: string | null;
  /** Excel’de öğretmen bloğu (Seçmeli Dersleri ayırıcıları arası). */
  block_index: number;
}

/** PDF sayfasından öğretmen özeti. */
export interface PdfTeacherPageRecord {
  page: number;
  teacher: string | null;
  branch: string | null;
  slots: PdfTeacherSlotRecord[];
  raw_page_excerpt: string;
}

export interface PdfTeacherSlotRecord {
  day: string | null;
  day_num: number | null;
  slot: number | null;
  time: string | null;
  course: string | null;
  groups: string[];
  raw_text: string;
}

export interface ReconcileScheduleItem {
  day: string;
  day_num: number;
  slot: number;
  time: string | null;
  course: string;
  groups: string[];
  class_section: string;
  source_pdf: Record<string, unknown>;
  source_xls: Record<string, unknown>;
  confidence: number;
  needs_review: boolean;
}

export interface ReconcileTeacherResult {
  teacher: string;
  branch: string | null;
  schedule: ReconcileScheduleItem[];
}

export interface ReconcileGptPayload {
  xls_records: XlsRawCellRecord[];
  pdf_teachers: PdfTeacherPageRecord[];
  xls_meta: { sheet: string; row_count: number; record_count: number; truncated: boolean };
  pdf_meta: { page_count: number; teacher_count: number };
}

export interface ReconcileGptResponse {
  confidence: number;
  teachers: ReconcileTeacherResult[];
  warnings: string[];
}

/** Taslağa yazılacak düz satır. */
export interface ReconciledFlatRow {
  teacher_name: string;
  day: number;
  lesson_num: number;
  class_section: string;
  subject: string;
  confidence: number;
  needs_review: boolean;
}
