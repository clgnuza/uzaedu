export type DtRulesConfig = {
  /** Ödeme kaydı öncesi dosyada en az bir karar (award) satırı zorunlu */
  require_award_before_payment: boolean;
  /** Ödeme öncesi dosyada bütçe hesabı seçili olmalı */
  require_budget_account_on_file: boolean;
  /** Ödeme mutlaka bir teklif (firma teklifi) ile ilişkilendirilmeli */
  require_quote_on_payment: boolean;
  /** 0 = not zorunlu; >0 ise not uzunluğu */
  payment_note_min_length: number;
  /** Okul yöneticilerine gösterilen metin (kurallar / hatırlatmalar) */
  platform_notice_tr: string;
};

export const DEFAULT_DT_RULES: DtRulesConfig = {
  require_award_before_payment: false,
  require_budget_account_on_file: false,
  require_quote_on_payment: false,
  payment_note_min_length: 0,
  platform_notice_tr: '',
};

export function mergeDtRulesFromStored(stored: Partial<DtRulesConfig> | null): DtRulesConfig {
  return { ...DEFAULT_DT_RULES, ...(stored ?? {}) };
}
