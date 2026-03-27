import type { ExamDutyFeeCatalog, ExamDutyFeeRoleRow } from './exam-duty-fee-catalog';

export type ExamDutyComputeOptions = {
  quantity: number;
  taxRate: number;
  gvUsed: number;
  dvUsed: number;
};

export type ExamDutyComputeResult = {
  unitBrut: number;
  totalBrut: number;
  taxOnBrut: number;
  gvExemptionUsed: number;
  gvExemptionRemaining: number;
  gvKesinti: number;
  dvExemptionMatrahUsed: number;
  dvExemptionMatrahRemaining: number;
  dvKesinti: number;
  net: number;
};

function round2(x: number): number {
  return Math.floor(x * 100) / 100;
}

function round2Std(x: number): number {
  return Math.round(x * 100) / 100;
}

export function parseNum(value: string | number | null | undefined): number {
  const n = parseFloat(String(value ?? '').replace(/,/g, '.'));
  return Number.isNaN(n) ? 0 : Math.max(0, n);
}

export function computeExamDutyResult(
  catalog: ExamDutyFeeCatalog,
  role: ExamDutyFeeRoleRow | undefined,
  options: ExamDutyComputeOptions,
): ExamDutyComputeResult {
  const quantity = Math.max(1, Math.round(options.quantity || 1));
  const unitBrut = round2(role?.brut_tl ?? 0);
  const totalBrut = round2(unitBrut * quantity);

  const taxOnBrut = round2Std(totalBrut * (Math.max(0, options.taxRate) / 100));

  const gvMax = parseNum(catalog.gv_exemption_max_tl);
  const remainingGvExempt = round2(Math.max(0, gvMax - parseNum(options.gvUsed)));
  const gvExemptionUsed = round2(Math.min(taxOnBrut, remainingGvExempt));
  const gvExemptionRemaining = round2(Math.max(0, remainingGvExempt - gvExemptionUsed));
  const gvKesinti = round2Std(Math.max(0, taxOnBrut - remainingGvExempt));

  const dvMax = parseNum(catalog.dv_exemption_max_tl);
  const remainingDvExempt = round2(Math.max(0, dvMax - parseNum(options.dvUsed)));
  const dvExemptionMatrahUsed = round2(Math.min(totalBrut, remainingDvExempt));
  const dvExemptionMatrahRemaining = round2(Math.max(0, remainingDvExempt - dvExemptionMatrahUsed));
  const dvMatrah = round2(Math.max(0, totalBrut - remainingDvExempt));
  const dvKesinti = round2Std(dvMatrah * (parseNum(catalog.stamp_duty_rate_binde) / 1000));

  const net = round2Std(totalBrut - gvKesinti - dvKesinti);

  return {
    unitBrut,
    totalBrut,
    taxOnBrut,
    gvExemptionUsed,
    gvExemptionRemaining,
    gvKesinti,
    dvExemptionMatrahUsed,
    dvExemptionMatrahRemaining,
    dvKesinti,
    net,
  };
}
