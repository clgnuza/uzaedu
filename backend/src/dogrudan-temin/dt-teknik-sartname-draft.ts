import { v4 as uuidv4 } from 'uuid';

export const DT_TEKNIK_SARTNAME_DRAFT_VERSION = 1 as const;

export type DtTeknikSartnameTableRow = { id: string; name: string; spec: string };

export type DtTeknikSartnameDraftV1 = {
  version: typeof DT_TEKNIK_SARTNAME_DRAFT_VERSION;
  schoolLine: string;
  docTitle: string;
  s1_title: string;
  s1_1: string;
  s2_title: string;
  s2_idare: string;
  s2_firma: string;
  s3_title: string;
  s3_1: string;
  s4_title: string;
  s4_jobName: string;
  s5_title: string;
  s5_bullets: string[];
  tableTitle: string;
  tableRows: DtTeknikSartnameTableRow[];
  s6_title: string;
  s6_body: string;
  s7_title: string;
  s7_1: string;
  s7_2: string;
  s7_3: string;
  documentDate: string | null;
  firmSignCaption: string;
  schoolStampLine: string;
  schoolTitleLine: string;
  schoolRoleLine: string;
};

type DraftInput = {
  schoolName: string;
  subject: string;
  items: Array<{ name: string; spec: string | null }>;
};

const L4000 = 4000;
const L512 = 512;
const L256 = 256;

function trunc(s: string, max: number): string {
  const t = (s ?? '').toString();
  return t.length <= max ? t : t.slice(0, max);
}

function str(v: unknown, fallback: string, max: number): string {
  if (v == null) return fallback;
  return trunc(String(v), max);
}

function strArr(v: unknown, fallback: string[]): string[] {
  if (!Array.isArray(v)) return [...fallback];
  const out = v.map((x) => trunc(String(x ?? '').trim(), L4000)).filter((x) => x.length > 0);
  return out.length ? out : [...fallback];
}

function tableRowsFromRaw(
  v: unknown,
  items: Array<{ name: string; spec: string | null }>,
): DtTeknikSartnameTableRow[] {
  const fromItems = (): DtTeknikSartnameTableRow[] =>
    items.map((it) => ({
      id: uuidv4(),
      name: trunc(it.name ?? '', L512),
      spec: trunc((it.spec ?? '').trim(), L4000),
    }));

  if (!Array.isArray(v) || v.length === 0) return fromItems();

  const rows: DtTeknikSartnameTableRow[] = [];
  for (const raw of v) {
    if (!raw || typeof raw !== 'object') continue;
    const o = raw as Record<string, unknown>;
    const id = typeof o.id === 'string' && o.id.trim() ? o.id.trim() : uuidv4();
    rows.push({
      id,
      name: str(o.name, '', L512),
      spec: str(o.spec, '', L4000),
    });
  }
  return rows.length ? rows : fromItems();
}

export function buildDefaultDtTeknikSartnameDraft(input: DraftInput): DtTeknikSartnameDraftV1 {
  const school = (input.schoolName ?? '').trim() || 'Kurum';
  const schoolLine = `${school} MÜDÜRLÜĞÜ`.toUpperCase();
  const subject = (input.subject ?? '').trim() || '—';

  const s5_bullets = [
    'Satın alınacak ürün/ürünlerin özelliklerinin en az teknik şartnamede belirtilmiş özelliklerde olması ön koşuldur.',
    'Müdürlüğümüzün ihtiyaçlarının tam, kaliteli, talebi karşılar nitelikte, sıfır ve kullanılmamış ürünlerden karşılanması öncelikli şarttır.',
    'Firmalar tüm ürün/hizmete ait garanti sürelerini tekliflerinde açıkça ve ayrıca belirtecektir.',
    'Tekliflerinizde ürünlerin teslimat tarihlerine ait bilgiler mutlaka bildirilmelidir.',
    'Müdürlüğümüz tarafından numune talep edilmesi halinde firma numune sağlamak durumundadır. Tüm nakliye, navlun, sigorta, gümrük, benzeri maliyetler ve tüm vergiler firma tarafından ödenir.',
    'Satın alımımıza ait şartname maddelerinin tümüne teklif verilecektir. Ayrı ayrı, parçalı ve alternatif teklif verilemez.',
    'Alımla ilgili tüm dokümanlar kaşelenmeli ve imzalanarak onaylanmalıdır.',
    'Firma, resmi teklifinde belirtmiş olduğu ürün fiyatları haricinde başka hiçbir koşul veya isim altında bedel talep etmeyecektir.',
    'İşbu dokümandan doğan/doğacak damga vergisi firma tarafından ödenecektir.',
  ];

  return {
    version: DT_TEKNIK_SARTNAME_DRAFT_VERSION,
    schoolLine,
    docTitle: 'TEKNİK ŞARTNAME',
    s1_title: '1. Giriş, Amaç ve Kapsam',
    s1_1:
      '1.1 Bu teknik şartname; satın alınacak mal ve malzemelerin teknik özelliklerini, teslimat ve kabul ile ilgili asgari hususları düzenler. Satın alınacak ürünlerin kaliteli, yeni ve kullanılmamış olması esastır.',
    s2_title: '2. Tanımlar',
    s2_idare: `İdare: ${school} Müdürlüğü`,
    s2_firma: 'Firma: Satın alma konusu iş için fiyat araştırması ve/veya teklif veren gerçek veya tüzel kişi.',
    s3_title: '3. Onaydan sonra Teklifin sunulması',
    s3_1:
      '3.1 Teklifler, idarece belirlenen usule uygun olarak kapalı zarf veya elektronik ortamda sunulur. Teklif mektubu ve eki belgeler okunaklı biçimde imzalanır; zarfın ve belgelerin mühürlenmesi veya kaşelenmesi istenen hallerde buna uyulur.',
    s4_title: '4. Satın Alım Konusu İşe İlişkin Bilgiler',
    s4_jobName: subject,
    s5_title: '5. Satın Alma İlişkin Genel Koşullar',
    s5_bullets,
    tableTitle: 'Satın Alınacak Mal/Malzeme Listesi',
    tableRows: tableRowsFromRaw(null, input.items),
    s6_title: '6. Garanti, Destek, Servis Şartları',
    s6_body:
      'Ürün/hizmete ilişkin ayıplı ifa veya eksikliklerin giderilmesi için firmaya yazılı bildirim yapılır. Firma, makul süre içinde (ör. 7 iş günü) gerekli düzeltmeyi yapmakla yükümlüdür; aksi halde idarece yürütülecek işlemler saklıdır.',
    s7_title: '7. Teslimat Şartları',
    s7_1: '7.1 Teslimat adresi: (Okul adresi / teslim noktası — düzenlenebilir.)',
    s7_2: '7.2 Teslimat; idarece bildirilen süre ve yönteme uygun olarak yapılır.',
    s7_3:
      '7.3 Teslimat; Kabul ve Muayene Komisyonu tarafından sayım ve teknik kontrolün tamamlanmasıyla kesinleşmiş sayılır.',
    documentDate: null,
    firmSignCaption: 'FİRMA/KAŞE',
    schoolStampLine: 'İmza/Mühür',
    schoolTitleLine: 'Müdür',
    schoolRoleLine: 'İhale(Harcama Yetkilisi)',
  };
}

export function normalizeDtTeknikSartnameDraft(raw: unknown, input: DraftInput): DtTeknikSartnameDraftV1 {
  const base = buildDefaultDtTeknikSartnameDraft(input);
  if (!raw || typeof raw !== 'object') return base;
  const o = raw as Record<string, unknown>;
  if (o.version !== DT_TEKNIK_SARTNAME_DRAFT_VERSION) return base;

  let bullets = strArr(o.s5_bullets, base.s5_bullets);
  if (typeof o.s5_bulletsBlock === 'string' && o.s5_bulletsBlock.trim()) {
    bullets = o.s5_bulletsBlock
      .split(/\n+/)
      .map((l) => l.replace(/^\s*[*•-]\s*/, '').trim())
      .filter(Boolean)
      .map((l) => trunc(l, L4000));
    if (!bullets.length) bullets = [...base.s5_bullets];
  }

  return {
    version: DT_TEKNIK_SARTNAME_DRAFT_VERSION,
    schoolLine: str(o.schoolLine, base.schoolLine, L512),
    docTitle: str(o.docTitle, base.docTitle, L256),
    s1_title: str(o.s1_title, base.s1_title, L256),
    s1_1: str(o.s1_1, base.s1_1, L4000),
    s2_title: str(o.s2_title, base.s2_title, L256),
    s2_idare: str(o.s2_idare, base.s2_idare, L512),
    s2_firma: str(o.s2_firma, base.s2_firma, L512),
    s3_title: str(o.s3_title, base.s3_title, L256),
    s3_1: str(o.s3_1, base.s3_1, L4000),
    s4_title: str(o.s4_title, base.s4_title, L256),
    s4_jobName: str(o.s4_jobName, base.s4_jobName, L512),
    s5_title: str(o.s5_title, base.s5_title, L256),
    s5_bullets: bullets.map((b) => trunc(b, L4000)),
    tableTitle: str(o.tableTitle, base.tableTitle, L256),
    tableRows: tableRowsFromRaw(o.tableRows, input.items),
    s6_title: str(o.s6_title, base.s6_title, L256),
    s6_body: str(o.s6_body, base.s6_body, L4000),
    s7_title: str(o.s7_title, base.s7_title, L256),
    s7_1: str(o.s7_1, base.s7_1, L4000),
    s7_2: str(o.s7_2, base.s7_2, L4000),
    s7_3: str(o.s7_3, base.s7_3, L4000),
    documentDate: typeof o.documentDate === 'string' && o.documentDate.trim() ? trunc(o.documentDate.trim(), 32) : null,
    firmSignCaption: str(o.firmSignCaption, base.firmSignCaption, L256),
    schoolStampLine: str(o.schoolStampLine, base.schoolStampLine, L256),
    schoolTitleLine: str(o.schoolTitleLine, base.schoolTitleLine, L256),
    schoolRoleLine: str(o.schoolRoleLine, base.schoolRoleLine, L256),
  };
}
