import { apiFetch } from '@/lib/api';

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
  council_meeting_place?: string;
  council_meeting_topic?: string;
  council_agenda?: string;
  principal_signature_label?: string;
  notification_title?: string;
  notification_subject?: string;
  notification_ref?: string;
  notification_body?: string;
  notification_acknowledgement?: string;
  teacher_signature_label?: string;
};

export const NOTIFICATION_PLACEHOLDERS = [
  { key: '{{okul_adi}}', desc: 'Okul adı' },
  { key: '{{ogretim_yili}}', desc: 'Öğretim yılı' },
  { key: '{{program_adi}}', desc: 'Program adı' },
  { key: '{{ogretmen_adi}}', desc: 'Öğretmen adı' },
  { key: '{{brans}}', desc: 'Branş' },
  { key: '{{tarih}}', desc: 'Tebliğ tarihi' },
  { key: '{{sayi}}', desc: 'Belge sayısı' },
  { key: '{{konu}}', desc: 'Konu' },
  { key: '{{mudur_adi}}', desc: 'Okul müdürü' },
] as const;

export const DEFAULT_NOTIFICATION_TITLE = 'ÖĞRETMEN DERS PROGRAMI TEBLİĞ TUTANAĞI';
export const DEFAULT_NOTIFICATION_SUBJECT = 'Haftalık Ders Programının Tebliği';
export const DEFAULT_NOTIFICATION_REF = '{{ogretim_yili}}/DDP-{{sira}}';
export const DEFAULT_NOTIFICATION_BODY = `{{ogretim_yili}} Eğitim-Öğretim Yılında okulumuzda uygulanacak haftalık ders programı, Millî Eğitim Bakanlığı mevzuatı ile okul örgütüne uygun olarak hazırlanmış olup tarafınıza tebliğ edilmiştir.

Aşağıda yer alan ders çizelgesinde belirtilen görevleri programa uygun biçimde yerine getirmeniz; programda değişiklik gerektiren hususları okul idaresine yazılı olarak bildirmeniz önemle rica olunur.`;
export const DEFAULT_NOTIFICATION_ACK =
  'Yukarıda belirtilen haftalık ders programının tarafıma tebliğ edildiğini ve programa uygun olarak görevlerimi yerine getireceğimi beyan ederim.';
export const DEFAULT_TEACHER_SIGNATURE_LABEL = 'Öğretmen';

export type StudioReportSettings = {
  meta: ReportMeta;
  texts: ReportTexts;
};

export const REPORT_PRINT_MODE_KEY = 'dd-report-print-mode';
export type ReportPrintMode = 'color' | 'bw';

export function loadReportPrintMode(): ReportPrintMode {
  if (typeof window === 'undefined') return 'color';
  const v = localStorage.getItem(REPORT_PRINT_MODE_KEY);
  return v === 'bw' ? 'bw' : 'color';
}

export function saveReportPrintMode(mode: ReportPrintMode) {
  localStorage.setItem(REPORT_PRINT_MODE_KEY, mode);
}

export async function fetchReportSettings(token: string, studioId: string): Promise<StudioReportSettings> {
  return apiFetch<StudioReportSettings>(`/ders-dagit/studios/${studioId}/report-settings`, { token });
}

export async function patchReportSettings(
  token: string,
  studioId: string,
  body: { meta?: Partial<ReportMeta>; texts?: Partial<ReportTexts> },
): Promise<StudioReportSettings> {
  return apiFetch<StudioReportSettings>(`/ders-dagit/studios/${studioId}/report-settings`, {
    token,
    method: 'PATCH',
    body,
  });
}

export function reportHeaderLine(
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
