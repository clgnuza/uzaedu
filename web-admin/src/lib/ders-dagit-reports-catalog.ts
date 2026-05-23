import type { downloadDersDagitExport } from '@/lib/ders-dagit-api';

export type ExportKind = Parameters<typeof downloadDersDagitExport>[3];

export type ReportItemDef = {
  id: string;
  title: string;
  description: string;
  status: 'live' | 'soon';
  kind?:
    | 'download'
    | 'link'
    | 'print-cover'
    | 'print-approval'
    | 'program-print'
    | 'parent-pdf'
    | 'parent-zip';
  exportKind?: ExportKind;
  href?: string;
  view?: 'class' | 'teacher' | 'room' | 'all';
};

export type ReportGroupDef = {
  id: string;
  title: string;
  description: string;
  items: ReportItemDef[];
};

/** MEB + Bilsa/aSc: çarşaf liste, haftalık çizelge, kurul, e-Okul */
export const REPORT_GROUPS: ReportGroupDef[] = [
  {
    id: 'carsaf',
    title: 'Çarşaf listeler (Bilsa / aSc)',
    description:
      'Toplu çarşaf liste: satırda öğretmen, sınıf veya derslik; sütunda gün ve ders saati. Renkli veya siyah-beyaz.',
    items: [
      {
        id: 'master-teacher',
        title: 'Toplu çarşaf liste — Öğretmenler',
        description: 'Tüm öğretmenler tek tabloda (A3 yatay, ders renk kodlu).',
        status: 'live',
        kind: 'download',
        exportKind: 'master_teacher_pdf',
      },
      {
        id: 'master-class',
        title: 'Toplu çarşaf liste — Sınıflar',
        description: 'Tüm şubeler; hücrede ders ve öğretmen kısaltması.',
        status: 'live',
        kind: 'download',
        exportKind: 'master_class_pdf',
      },
      {
        id: 'master-room',
        title: 'Toplu çarşaf liste — Derslikler',
        description: 'Derslik doluluk matrisi.',
        status: 'live',
        kind: 'download',
        exportKind: 'master_room_pdf',
      },
    ],
  },
  {
    id: 'program',
    title: 'Haftalık çizelgeler',
    description:
      'TTKB uyumlu şube / veli tabloları ve editörden yazdırma (sınıf, öğretmen, derslik).',
    items: [
      {
        id: 'class-pdf',
        title: 'Sınıf haftalık çizelge (PDF)',
        description: 'Her şube ayrı sayfa — resmi ızgara (ders, öğretmen, derslik).',
        status: 'live',
        kind: 'download',
        exportKind: 'pdf',
      },
      {
        id: 'class-xlsx',
        title: 'Program ızgarası (Excel)',
        description: 'Düzenlenebilir XLSX ızgara dışa aktarım.',
        status: 'live',
        kind: 'download',
        exportKind: 'xlsx',
      },
      {
        id: 'class-grid-print',
        title: 'Sınıf haftalık çizelge — yazdır',
        description:
          'Resmi PDF şablonu (rapor indirmesi ile aynı). Editörde filtreyle şube seçilir; sekmede açılır. Tüm şubeler: «Sınıf haftalık çizelge (PDF)».',
        status: 'live',
        kind: 'program-print',
        view: 'class',
      },
      {
        id: 'teacher-grid-print',
        title: 'Öğretmen haftalık program — yazdır',
        description:
          'Resmi PDF — seçili öğretmen haftalık ızgarası. Filtreden öğretmen değiştirilebilir. Tüm öğretmenler: çarşaf PDF.',
        status: 'live',
        kind: 'program-print',
        view: 'teacher',
      },
      {
        id: 'room-grid-print',
        title: 'Derslik haftalık program — yazdır',
        description:
          'Resmi PDF — seçili derslik haftalık ızgarası. Yatay A4; tarayıcıdan yazdırın.',
        status: 'live',
        kind: 'program-print',
        view: 'room',
      },
      {
        id: 'csv-export',
        title: 'Ham program (CSV)',
        description: 'Tüm satırlar — entegrasyon / arşiv.',
        status: 'live',
        kind: 'download',
        exportKind: 'csv',
      },
    ],
  },
  {
    id: 'kurum',
    title: 'Kurum belgeleri',
    description: 'Kapak, kurul onayı ve resmi başlık metinleri (müdür imza alanı).',
    items: [
      {
        id: 'cover-preview',
        title: 'Kapak sayfası önizleme',
        description: 'Resmi kapak PDF (T.C. / MEB antet) — sekmede açılır, yazdırın.',
        status: 'live',
        kind: 'print-cover',
      },
      {
        id: 'council-pdf',
        title: 'Zümre kurulu tutanağı (PDF)',
        description:
          'Resmi tutanak: toplantı bilgileri, gündem, kararlar, katılımcılar, şube tablosu ve imza.',
        status: 'live',
        kind: 'download',
        exportKind: 'council_pdf',
      },
      {
        id: 'approval-preview',
        title: 'Onay bloğu önizleme',
        description: 'Onay metni ve imza alanları — kurul PDF ile aynı şablon.',
        status: 'live',
        kind: 'print-approval',
      },
      {
        id: 'teacher-notification-pdf',
        title: 'Öğretmene tebliğ tutanağı (PDF)',
        description:
          'Resmi başlıklı tebliğ: her öğretmen için haftalık program, tebliğ metni ve imza alanları. Metinler aşağıdan düzenlenir.',
        status: 'live',
        kind: 'download',
        exportKind: 'teacher_notification_pdf',
      },
    ],
  },
  {
    id: 'ozet',
    title: 'Özet ve denge',
    description: 'Öğretmen yükü, doğrulama ve e-Okul uyumluluk çıktıları.',
    items: [
      {
        id: 'fairness',
        title: 'Öğretmen yükü özeti',
        description: 'Haftalık ders saati dağılımı ve adalet skoru.',
        status: 'live',
        kind: 'link',
        href: '/ders-dagit/studyo/adalet',
      },
      {
        id: 'eokul-xlsx',
        title: 'e-Okul program (XLSX)',
        description: 'e-Okul uyumlu çalışma kitabı + doğrulama sayfası.',
        status: 'live',
        kind: 'download',
        exportKind: 'eokul_xlsx',
      },
      {
        id: 'eokul-csv',
        title: 'e-Okul aktarım (CSV)',
        description: 'Öğretmen TC ve durum sütunları.',
        status: 'live',
        kind: 'download',
        exportKind: 'eokul',
      },
      {
        id: 'eokul-report',
        title: 'e-Okul doğrulama raporu (CSV)',
        description: 'Üretim / uyumluluk özet raporu.',
        status: 'live',
        kind: 'download',
        exportKind: 'eokul_report',
      },
      {
        id: 'empty-slots',
        title: 'Boş saatler raporu',
        description: 'Öğretmen ve sınıf boşluk analizi.',
        status: 'soon',
      },
    ],
  },
  {
    id: 'paylasim',
    title: 'Veli ve paylaşım',
    description: 'Veli bilgilendirme çıktıları (öğretmen adı gizli ızgara).',
    items: [
      {
        id: 'parent-pdf',
        title: 'Öğrenci / veli el programı (PDF)',
        description: 'Tek şube haftalık çizelge (Bilsa öğrenci el programı).',
        status: 'live',
        kind: 'parent-pdf',
      },
      {
        id: 'parent-zip',
        title: 'Tüm şubeler veli PDF (ZIP)',
        description: 'Her şube için ayrı PDF arşivi.',
        status: 'live',
        kind: 'parent-zip',
      },
      {
        id: 'publish',
        title: 'Yayın ve paylaşım linki',
        description: 'Veli görünümü ve okul yayını.',
        status: 'live',
        kind: 'link',
        href: '/ders-dagit/studyo/program?panel=publish',
      },
    ],
  },
  {
    id: 'meb-ozel',
    title: 'Planlanan (MEB uyumlu)',
    description: 'Nöbet, ikili eğitim ve ek ders özetleri — yayınlı verilerden PDF.',
    items: [
      {
        id: 'duty-schedule',
        title: 'Nöbet çizelgesi (PDF)',
        description: 'Yayınlı nöbet planı — öğretmen × gün özeti.',
        status: 'live',
        kind: 'download',
        exportKind: 'duty_pdf',
      },
      {
        id: 'dual-education',
        title: 'İkili eğitim program tablosu (PDF)',
        description: 'Şube vardiyası; sabah / öğle saat dağılımı.',
        status: 'live',
        kind: 'download',
        exportKind: 'dual_education_pdf',
      },
      {
        id: 'extra-lesson',
        title: 'Ek ders / maaş karşılığı özeti (PDF)',
        description: 'Norm, gerçekleşen ve fark — aktif programdan.',
        status: 'live',
        kind: 'download',
        exportKind: 'extra_lesson_pdf',
      },
    ],
  },
];
