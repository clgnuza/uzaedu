/** Backend `ExamDutyFeeCatalog` ile uyumlu (app-config exam_duty_fee_catalog). */

export type ExamDutyFeeRoleRow = {
  key: string;
  label: string;
  brut_tl: number;
};

export type ExamDutyFeeCategory = {
  id: string;
  label: string;
  description?: string | null;
  roles: ExamDutyFeeRoleRow[];
};

export type ExamDutyFeeTaxBracketRef = {
  max_matrah: number;
  rate_percent: number;
};

export type ExamDutyFeeCatalog = {
  version: string;
  period_label: string;
  source_note: string;
  gv_note: string;
  gv_exemption_max_tl: number;
  dv_exemption_max_tl: number;
  stamp_duty_rate_binde: number;
  gv_brackets: ExamDutyFeeTaxBracketRef[];
  categories: ExamDutyFeeCategory[];
};
