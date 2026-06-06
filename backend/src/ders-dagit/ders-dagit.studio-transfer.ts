/** Stüdyo içe/dışa aktarım — format kataloğu ve paket sürümü */

export const STUDIO_TRANSFER_VERSION = 1;

/** Dosya içeriğinden içe aktarma formatını tahmin et */
export function sniffTransferImportFormat(buffer: Buffer): TransferFormatId | null {
  const head = buffer.slice(0, 4096).toString('utf8').replace(/^\uFEFF/, '').trimStart();
  if (!head) return null;
  if (head.startsWith('{') || head.includes('"ogretmenpro_studio_v1"')) return 'ogretmenpro_json';
  if (
    head.startsWith('<?xml') &&
    (/<timetable[\s>]/i.test(head) || /<Timetable[\s>]/i.test(head))
  ) {
    return 'asc_xml';
  }
  if (head.startsWith('PK')) return 'eokul_excel';
  const lower = head.slice(0, 512).toLowerCase();
  if (lower.includes('ders') && (lower.includes(';') || lower.includes('\t'))) return 'eokul_excel';
  return null;
}

/** UI’da yanlış seçilmiş formatı dosya içeriğine göre düzelt */
export function resolveTransferImportFormat(
  requested: string,
  sniffed: TransferFormatId | null,
): TransferFormatId | string {
  if (!sniffed || sniffed === requested) return requested;
  if (requested === 'eokul_excel') return sniffed;
  if (sniffed === 'asc_xml' || sniffed === 'ogretmenpro_json') return sniffed;
  return requested;
}

export type TransferFormatId =
  | 'ogretmenpro_json'
  | 'asc_xml'
  | 'eokul_excel'
  | 'assignment_csv'
  | 'assignment_xlsx'
  | 'program_eokul'
  | 'program_excel';

export type TransferFormatInfo = {
  id: TransferFormatId;
  direction: 'import' | 'export' | 'both';
  label_tr: string;
  hint_tr: string;
  extensions: string[];
  /** Bilsa / benzeri */
  vendor?: 'ogretmenpro' | 'asc' | 'bilsa' | 'eokul' | 'generic';
};

export const TRANSFER_FORMAT_CATALOG: TransferFormatInfo[] = [
  {
    id: 'ogretmenpro_json',
    direction: 'both',
    label_tr: 'ÖğretmenPro stüdyo yedeği (JSON)',
    hint_tr: 'Dersler, atamalar, gruplar, seçmeli havuzlar, dönem ve okul profili. Program çizelgesi dahil değildir.',
    extensions: ['.json'],
    vendor: 'ogretmenpro',
  },
  {
    id: 'asc_xml',
    direction: 'import',
    label_tr: 'aSc Timetables XML',
    hint_tr: 'aSc: Dosya → Dışa aktar → aSc Timetables 2012 XML. Ders kartları atama listesine dönüşür.',
    extensions: ['.xml'],
    vendor: 'asc',
  },
  {
    id: 'eokul_excel',
    direction: 'import',
    label_tr: 'e-Okul / çarşaf Excel (Bilsa benzeri ızgara)',
    hint_tr: 'Tablo XLSX, program ızgarası XLS veya CSV. Bilsa ve diğer programlardan Excel kopyası da denenebilir.',
    extensions: ['.xlsx', '.xls', '.csv'],
    vendor: 'eokul',
  },
  {
    id: 'assignment_csv',
    direction: 'import',
    label_tr: 'Atama listesi CSV',
    hint_tr: 'Ders;Şube;Saat;Öğretmen sütunları. Şablonu Atamalar sayfasından indirebilirsiniz.',
    extensions: ['.csv'],
    vendor: 'generic',
  },
  {
    id: 'assignment_xlsx',
    direction: 'import',
    label_tr: 'Atama listesi Excel',
    hint_tr: 'Standart atama şablonu (.xlsx).',
    extensions: ['.xlsx'],
    vendor: 'generic',
  },
  {
    id: 'program_eokul',
    direction: 'export',
    label_tr: 'Üretilmiş program → e-Okul',
    hint_tr: 'Program oluşturduktan sonra Raporlar → e-Okul dışa aktarma.',
    extensions: ['.csv', '.xlsx'],
    vendor: 'eokul',
  },
  {
    id: 'program_excel',
    direction: 'export',
    label_tr: 'Üretilmiş program → Excel / PDF',
    hint_tr: 'Raporlar ve program editörü yazdırma.',
    extensions: ['.xlsx', '.pdf'],
    vendor: 'generic',
  },
];

export type StudioTransferPackageV1 = {
  format: 'ogretmenpro_studio_v1';
  version: number;
  exported_at: string;
  studio: { title?: string; academic_year?: string | null };
  school_profile: unknown;
  periods: unknown;
  section_schedules: unknown;
  dual_education: unknown;
  report_settings: unknown;
  subjects: Array<{
    name: string;
    short_code: string | null;
    is_elective: boolean;
    class_hours: Record<string, number>;
  }>;
  assignments: Array<{
    subject_name: string;
    class_sections: string[];
    weekly_hours: number;
    teacher_ids: string[];
    room_ids: string[];
    group_id: string | null;
  }>;
  groups: Array<{
    name: string;
    abbreviation: string;
    parallel_mode: string | null;
    member_sections: string[];
  }>;
  elective_pools: Array<{
    name: string;
    base_section: string;
    member_sections: string[];
    subject_names: string[];
    weekly_hours_per_track: number;
  }>;
  class_profiles: unknown[];
  rooms: Array<{ building_name: string; name: string }>;
  counts: {
    programs: number;
    assignments: number;
    subjects: number;
  };
};
