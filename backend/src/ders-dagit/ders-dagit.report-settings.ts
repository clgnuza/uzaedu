/** Stüdyo settings.report_meta + settings.report_texts — yazdırma / rapor başlıkları */

export type ReportMeta = {
  school_name?: string;
  address?: string;
  phone?: string;
  academic_year?: string;
  principal_name?: string;
};

export type ReportTexts = {
  title?: string;
  subtitle?: string;
  footer_note?: string;
  approval_text?: string;
  /** Kurul toplantı yeri */
  council_meeting_place?: string;
  /** Kurul toplantı konusu */
  council_meeting_topic?: string;
  /** Gündem maddeleri (satır satır) */
  council_agenda?: string;
  principal_signature_label?: string;
  /** Öğretmene tebliğ tutanağı başlığı */
  notification_title?: string;
  /** Tebliğ gövde metni ({{okul_adi}}, {{ogretmen_adi}} …) */
  notification_body?: string;
  /** Öğretmen beyan / tebellüğ metni */
  notification_acknowledgement?: string;
  /** Resmi yazı — Konu satırı */
  notification_subject?: string;
  /** Resmi yazı — Sayı ({{sira}} ile sıra no) */
  notification_ref?: string;
  teacher_signature_label?: string;
};

export type StudioReportSettings = {
  meta: ReportMeta;
  texts: ReportTexts;
};

const emptyMeta = (): ReportMeta => ({});
const emptyTexts = (): ReportTexts => ({});

function pickStr(v: unknown, max = 500): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t ? t.slice(0, max) : undefined;
}

export function parseReportMeta(raw: unknown): ReportMeta {
  if (!raw || typeof raw !== 'object') return emptyMeta();
  const o = raw as Record<string, unknown>;
  return {
    school_name: pickStr(o.school_name, 200),
    address: pickStr(o.address, 400),
    phone: pickStr(o.phone, 80),
    academic_year: pickStr(o.academic_year, 40),
    principal_name: pickStr(o.principal_name, 120),
  };
}

export function parseReportTexts(raw: unknown): ReportTexts {
  if (!raw || typeof raw !== 'object') return emptyTexts();
  const o = raw as Record<string, unknown>;
  return {
    title: pickStr(o.title, 200),
    subtitle: pickStr(o.subtitle, 300),
    footer_note: pickStr(o.footer_note, 500),
    approval_text: pickStr(o.approval_text, 3500),
    council_meeting_place: pickStr(o.council_meeting_place, 200),
    council_meeting_topic: pickStr(o.council_meeting_topic, 300),
    council_agenda: pickStr(o.council_agenda, 2000),
    principal_signature_label: pickStr(o.principal_signature_label, 120),
    notification_title: pickStr(o.notification_title, 200),
    notification_body: pickStr(o.notification_body, 2000),
    notification_acknowledgement: pickStr(o.notification_acknowledgement, 1200),
    notification_subject: pickStr(o.notification_subject, 200),
    notification_ref: pickStr(o.notification_ref, 120),
    teacher_signature_label: pickStr(o.teacher_signature_label, 120),
  };
}

export function parseStudioReportSettings(settings: Record<string, unknown> | undefined): StudioReportSettings {
  return {
    meta: parseReportMeta(settings?.report_meta),
    texts: parseReportTexts(settings?.report_texts),
  };
}

export function mergeReportSettings(
  prev: StudioReportSettings,
  body: { meta?: Partial<ReportMeta>; texts?: Partial<ReportTexts> },
): StudioReportSettings {
  return {
    meta: { ...prev.meta, ...body.meta },
    texts: { ...prev.texts, ...body.texts },
  };
}

export function reportSettingsToJson(s: StudioReportSettings): {
  report_meta: ReportMeta;
  report_texts: ReportTexts;
} {
  const meta: ReportMeta = {};
  const texts: ReportTexts = {};
  for (const [k, v] of Object.entries(s.meta)) {
    if (v) (meta as Record<string, string>)[k] = v;
  }
  for (const [k, v] of Object.entries(s.texts)) {
    if (v) (texts as Record<string, string>)[k] = v;
  }
  return { report_meta: meta, report_texts: texts };
}

/** PDF / önizleme başlık satırı */
export function buildReportHeaderLine(
  settings: StudioReportSettings,
  fallbacks: { schoolName?: string; academicYear?: string | null },
): string {
  const name =
    settings.meta.school_name?.trim() ||
    settings.texts.title?.trim() ||
    fallbacks.schoolName?.trim() ||
    'Okul';
  const year = settings.meta.academic_year?.trim() || fallbacks.academicYear?.trim();
  return year ? `${name} · ${year}` : name;
}
