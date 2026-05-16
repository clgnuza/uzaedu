/** Doğrudan temin — kullanıcı arayüzü etiketleri (API anahtarları ile uyumlu). */

export const DT_LEGAL_NOTICE =
  'Bu ekranlar idari kayıt ve belge üretimini kolaylaştırır; 4734 sayılı Kanun ve ilgili tebliğlere uygunluk okulunuzun hukuk/mali biriminin sorumluluğundadır. Resmi metin ve iç kontroller için kurum prosedürlerinizi uygulayın.';

export const DT_TEMIN_TYPES = [
  '22a_mal',
  '22b_hizmet',
  '22c_yapim',
  '22d_dig_isler',
  '22e_danismanlik',
  '22f_kirala',
  '22g_isletme',
] as const;
export type DtTeminTypeCode = (typeof DT_TEMIN_TYPES)[number];

/** «Diğer» seçeneği (select value; API’ye gitmez). */
export const DT_UNIT_SELECT_CUSTOM = '__dt_unit_other__';

/** Kalem birimi — sık kullanılan ölçüler (liste + «Diğer» ile serbest metin). */
export const DT_ITEM_UNIT_PRESETS = [
  'Adet',
  'Takım',
  'Set',
  'Çift',
  'Kutu',
  'Paket',
  'Koli',
  'Rulo',
  'Bobin',
  'Tomar',
  'mm',
  'cm',
  'm',
  'km',
  'm²',
  'm³',
  'mg',
  'g',
  'kg',
  'ton',
  'ml',
  'cl',
  'Lt',
  'Saat',
  'Gün',
  'Hafta',
  'Ay',
  'Yıl',
  'Kişi',
  'Öğrenci',
  'Sınıf',
  'kWh',
  'kW',
  'W',
  'Sayfa',
] as const;

const TEMIN_LABELS: Record<DtTeminTypeCode, string> = {
  '22a_mal': 'Mal alımı (KİK 22/a)',
  '22b_hizmet': 'Hizmet alımı (22/b)',
  '22c_yapim': 'Yapım işleri (22/c)',
  '22d_dig_isler': 'Diğer işler (22/d)',
  '22e_danismanlik': 'Danışmanlık (22/e)',
  '22f_kirala': 'Kiralama (22/f)',
  '22g_isletme': 'İşletme / hizmet (22/g)',
};

export function dtTeminTypeLabel(code: string | null | undefined): string {
  if (!code) return '—';
  return TEMIN_LABELS[code as DtTeminTypeCode] ?? code;
}

const FILE_STATUS: Record<string, { label: string; badgeClass: string }> = {
  draft: {
    label: 'Taslak',
    badgeClass: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100',
  },
  decision: {
    label: 'Karar aşaması',
    badgeClass: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-100',
  },
  awarded: {
    label: 'Kararlandı',
    badgeClass: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100',
  },
};

export function dtFileStatusLabel(status: string | null | undefined): string {
  if (!status) return '—';
  const k = status.trim().toLowerCase();
  return FILE_STATUS[k]?.label ?? status;
}

export function dtFileStatusBadgeClass(status: string | null | undefined): string {
  if (!status) return 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-100';
  const k = status.trim().toLowerCase();
  return FILE_STATUS[k]?.badgeClass ?? 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-100';
}

const QUOTE_STATUS: Record<string, { label: string; hint: string; chipClass: string }> = {
  requested: {
    label: 'İstendi',
    hint: 'Firmadan teklif bekleniyor veya süreç başlatıldı.',
    chipClass: 'border-amber-300/60 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100',
  },
  received: {
    label: 'Alındı',
    hint: 'Teklif geldi; fiyat satırlarını girebilirsiniz.',
    chipClass: 'border-sky-300/60 bg-sky-50 text-sky-900 dark:bg-sky-950/40 dark:text-sky-100',
  },
  rejected: {
    label: 'Reddedildi',
    hint: 'Bu teklif değerlendirme dışı bırakıldı.',
    chipClass: 'border-rose-300/60 bg-rose-50 text-rose-900 dark:bg-rose-950/40 dark:text-rose-100',
  },
  accepted: {
    label: 'Kabul',
    hint: 'Bu teklif kabul edildi (karar / ödeme ile ilişkilendirilebilir).',
    chipClass: 'border-emerald-300/60 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100',
  },
};

export function dtQuoteStatusLabel(status: string | null | undefined): string {
  if (!status) return '—';
  const k = status.trim().toLowerCase();
  return QUOTE_STATUS[k]?.label ?? status;
}

export function dtQuoteStatusHint(status: string | null | undefined): string {
  if (!status) return '';
  const k = status.trim().toLowerCase();
  return QUOTE_STATUS[k]?.hint ?? '';
}

export function dtQuoteStatusChipClass(status: string | null | undefined): string {
  if (!status) return 'border-border bg-muted/30 text-foreground';
  const k = status.trim().toLowerCase();
  return QUOTE_STATUS[k]?.chipClass ?? 'border-border bg-muted/30 text-foreground';
}

const DOC_TYPES: Record<string, string> = {
  ihtiyac_listesi: 'İhtiyaç listesi',
  fiyat_arastirmasi: 'Fiyat araştırması',
  teklif_isteme: 'Teklif mektubu',
  harcama_talimati: 'Harcama talimatı',
  karar: 'Doğrudan temin kararı',
  sozlesme: 'Sözleşme taslağı',
  komisyon_onay: 'Komisyon onay listesi',
  onay_belgesi: 'Onay belgesi',
  piyasa_arastirma_tutanagi: 'Piyasa araştırma tutanağı',
  yaklasik_maliyet_cetveli: 'Yaklaşık maliyet cetveli',
  muayene_kabul_tutanagi: 'Muayene ve kabul komisyonu kararı',
  teslim_tesellum_tutanagi: 'Teslim/tesellüm tutanağı',
  teknik_sartname: 'Teknik şartname',
};

export function dtDocTypeLabel(docType: string | null | undefined): string {
  if (!docType) return '—';
  const k = docType.trim().toLowerCase();
  return DOC_TYPES[k] ?? docType;
}

const BUDGET_BLOCK: Record<string, { label: string; hint: string }> = {
  blocked: {
    label: 'Aktif bloke',
    hint: 'Bu tutar dosya için ayrılmış görünür; işlem bitince kaldırın.',
  },
  released: {
    label: 'Kaldırıldı',
    hint: 'Blokaj serbest bırakıldı; hesap özetinde tekrar kullanılabilir.',
  },
};

export function dtBudgetBlockStatusLabel(status: string | null | undefined): string {
  if (!status) return '—';
  const k = status.trim().toLowerCase();
  return BUDGET_BLOCK[k]?.label ?? status;
}

export function dtBudgetBlockStatusHint(status: string | null | undefined): string {
  if (!status) return '';
  const k = status.trim().toLowerCase();
  return BUDGET_BLOCK[k]?.hint ?? '';
}

export type DtDetailTabId =
  | 'items'
  | 'quotes'
  | 'registry'
  | 'budget'
  | 'payments'
  | 'commission'
  | 'docs'
  | 'archive';

export const DT_DETAIL_TABS: Array<{
  id: DtDetailTabId;
  label: string;
  shortHint: string;
  activeClass: string;
  inactiveClass: string;
  iconActiveClass: string;
}> = [
  {
    id: 'items',
    label: 'İhtiyaç kalemleri',
    shortHint: 'Mal/hizmet satırları ve tahmini bedel.',
    activeClass:
      'border-emerald-500/80 bg-gradient-to-br from-emerald-500/18 via-emerald-400/8 to-teal-500/10 text-emerald-950 shadow-sm dark:from-emerald-500/25 dark:via-emerald-950/40 dark:to-teal-950/20 dark:text-emerald-50',
    inactiveClass:
      'border-border/40 bg-muted/15 text-muted-foreground hover:border-emerald-400/35 hover:bg-emerald-500/8 hover:text-emerald-900 dark:hover:text-emerald-100',
    iconActiveClass: 'text-emerald-600 dark:text-emerald-300',
  },
  {
    id: 'registry',
    label: 'Evrak defteri',
    shortHint: 'Evrak defteri: tarih ve sayı alanları.',
    activeClass:
      'border-fuchsia-500/80 bg-gradient-to-br from-fuchsia-500/18 via-fuchsia-400/8 to-pink-500/10 text-fuchsia-950 shadow-sm dark:from-fuchsia-500/22 dark:via-fuchsia-950/35 dark:to-pink-950/20 dark:text-fuchsia-50',
    inactiveClass:
      'border-border/40 bg-muted/15 text-muted-foreground hover:border-fuchsia-400/35 hover:bg-fuchsia-500/8 hover:text-fuchsia-900 dark:hover:text-fuchsia-100',
    iconActiveClass: 'text-fuchsia-600 dark:text-fuchsia-300',
  },
  {
    id: 'commission',
    label: 'Komisyonlar',
    shortHint: 'Yaklaşık/Piyasa/Muayene komisyonları.',
    activeClass:
      'border-violet-500/80 bg-gradient-to-br from-violet-500/18 via-violet-400/8 to-indigo-500/10 text-violet-950 shadow-sm dark:from-violet-500/22 dark:via-violet-950/35 dark:to-indigo-950/20 dark:text-violet-50',
    inactiveClass:
      'border-border/40 bg-muted/15 text-muted-foreground hover:border-violet-400/35 hover:bg-violet-500/8 hover:text-violet-900 dark:hover:text-violet-100',
    iconActiveClass: 'text-violet-600 dark:text-violet-300',
  },
  {
    id: 'quotes',
    label: 'Teklifler',
    shortHint: 'Firmalardan gelen fiyatlar.',
    activeClass:
      'border-sky-500/80 bg-gradient-to-br from-sky-500/18 via-sky-400/8 to-cyan-500/10 text-sky-950 shadow-sm dark:from-sky-500/22 dark:via-sky-950/35 dark:to-cyan-950/20 dark:text-sky-50',
    inactiveClass:
      'border-border/40 bg-muted/15 text-muted-foreground hover:border-sky-400/35 hover:bg-sky-500/8 hover:text-sky-900 dark:hover:text-sky-100',
    iconActiveClass: 'text-sky-600 dark:text-sky-300',
  },
  {
    id: 'docs',
    label: 'Belgeler',
    shortHint: 'PDF/DOCX çıktıları.',
    activeClass:
      'border-slate-500/80 bg-gradient-to-br from-slate-500/16 via-slate-400/8 to-zinc-500/10 text-slate-950 shadow-sm dark:from-slate-500/20 dark:via-slate-900/45 dark:to-zinc-950/25 dark:text-slate-100',
    inactiveClass:
      'border-border/40 bg-muted/15 text-muted-foreground hover:border-slate-400/35 hover:bg-slate-500/8 hover:text-slate-800 dark:hover:text-slate-200',
    iconActiveClass: 'text-slate-600 dark:text-slate-300',
  },
  {
    id: 'payments',
    label: 'Ödemeler',
    shortHint: 'Gerçekleşen ödeme kayıtları.',
    activeClass:
      'border-lime-600/80 bg-gradient-to-br from-lime-500/18 via-lime-400/8 to-green-500/10 text-lime-950 shadow-sm dark:from-lime-500/20 dark:via-lime-950/30 dark:to-green-950/20 dark:text-lime-50',
    inactiveClass:
      'border-border/40 bg-muted/15 text-muted-foreground hover:border-lime-500/35 hover:bg-lime-500/8 hover:text-lime-900 dark:hover:text-lime-100',
    iconActiveClass: 'text-lime-600 dark:text-lime-300',
  },
  {
    id: 'budget',
    label: 'Bütçe bloke',
    shortHint: 'Ödeme öncesi tutarı hesaptan ayırma.',
    activeClass:
      'border-amber-500/80 bg-gradient-to-br from-amber-500/18 via-amber-400/8 to-orange-500/10 text-amber-950 shadow-sm dark:from-amber-500/22 dark:via-amber-950/35 dark:to-orange-950/20 dark:text-amber-50',
    inactiveClass:
      'border-border/40 bg-muted/15 text-muted-foreground hover:border-amber-400/35 hover:bg-amber-500/8 hover:text-amber-900 dark:hover:text-amber-100',
    iconActiveClass: 'text-amber-600 dark:text-amber-300',
  },
  {
    id: 'archive',
    label: 'Arşiv',
    shortHint: 'Arşiv durumu, bağlantı paylaşımı ve arşivdeki dosyalar.',
    activeClass:
      'border-rose-500/80 bg-gradient-to-br from-rose-500/16 via-orange-400/8 to-amber-500/10 text-rose-950 shadow-sm dark:from-rose-500/20 dark:via-rose-950/35 dark:to-amber-950/20 dark:text-rose-50',
    inactiveClass:
      'border-border/40 bg-muted/15 text-muted-foreground hover:border-rose-400/35 hover:bg-rose-500/8 hover:text-rose-900 dark:hover:text-rose-100',
    iconActiveClass: 'text-rose-600 dark:text-rose-300',
  },
];

export const DT_SECTION_HINTS: Record<DtDetailTabId, string> = {
  items:
    'İhtiyaç kalemleri ve yaklaşık maliyet; piyasa araştırması ve onay belgesi süreçlerinizle uyumlu tutun. Aşağıdan kalem ekleyebilir veya otomatik karar / belge üretebilirsiniz.',
  quotes:
    'Fiyat araştırması ile teklif/ihale kayıtlarını ayrı sütunlarda görürsünüz; her firma kartı pastel renkle ayrılır. Her kalem için birim fiyat girilir; en uygun teklif seçimi kurumunuzun kararıdır.',
  registry:
    'Evrak defteri: tarih/sayı ve muayene-kabul karar no alanları. PDF/DOCX üst bilgisinde kullanılır.',
  budget:
    'Dosya için bütçe hesabını üstte seçin; bloke tutarı bu hesaptan düşer. Tertip ve ödenek tutarları «Bütçe hiyerarşisi» sayfasından tanımlanır.',
  payments:
    'Ödeme emri öncesi platform kuralları (üstteki uyarılar) uygulanır. Tutar, teklif ve not alanlarını eksiksiz doldurun.',
  commission:
    'Yaklaşık maliyet, piyasa araştırma/satın alma ve muayene/kabul komisyonları. “Yaklaşıktan kopyala” ile üyeleri senkronlayabilirsiniz.',
  docs:
    'Sistem tarafından üretilen şablon belgeler. İmzalanmadan önce okul şablon ve mevzuat kontrolünden geçirin.',
  archive:
    'Dosyayı arşivden çıkarın, kopyalayın veya bağlantıyı paylaşın. Aynı okulda arşivlenmiş diğer dosyaları buradan açabilirsiniz.',
};

/** Doğrudan temin formları — kompakt, yuvarlatılmış girişler */
export const DT_INPUT_SM =
  'h-9 rounded-xl border border-border/70 bg-background px-3 text-xs shadow-sm transition-[border-color,box-shadow] placeholder:text-muted-foreground/70 focus-visible:border-primary/45 focus-visible:ring-2 focus-visible:ring-primary/15 focus-visible:outline-none disabled:opacity-50';

export const DT_SELECT_SM = `${DT_INPUT_SM} cursor-pointer`;

export const DT_TEXTAREA_SM =
  'min-h-[88px] w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-xs shadow-sm transition-[border-color,box-shadow] placeholder:text-muted-foreground/70 focus-visible:border-primary/45 focus-visible:ring-2 focus-visible:ring-primary/15 focus-visible:outline-none disabled:opacity-50';

export function dtParseAmount(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const s = String(value).trim();
  if (!s) return null;
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  let norm = s.replace(/\s/g, '').replace(/[^\d.,-]/g, '');
  if (hasComma && hasDot) norm = norm.replace(/\./g, '').replace(',', '.');
  else if (hasComma) norm = norm.replace(',', '.');
  const n = Number(norm);
  return Number.isFinite(n) ? n : null;
}

export function dtFormatNumberTr(
  value: string | number | null | undefined,
  fractionDigits = 2,
): string {
  const n = dtParseAmount(value);
  if (n == null) return '—';
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(n);
}

/** Form / API metnindeki "5.000000", "12,500000" gibi değerleri kullanıcıya sade gösterim için kısaltır. */
export function dtStripNumericTrailingZeros(value: string | null | undefined): string {
  if (value == null) return '';
  const s = String(value).trim();
  if (!s) return '';
  const n = dtParseAmount(s);
  if (n == null || !Number.isFinite(n)) return s;
  if (n === 0 || Object.is(n, -0)) return '0';
  if (Number.isInteger(n)) return String(Math.trunc(n));
  return n
    .toFixed(12)
    .replace(/(\.\d*?)0+$/, '$1')
    .replace(/\.$/, '');
}

/** Tutar: gruplama yok, virgülden sonra her zaman 2 hane (örn. 1500,00). */
export function dtFormatAmountTr2(value: string | number | null | undefined): string {
  const n = dtParseAmount(value);
  if (n == null || !Number.isFinite(n)) return '';
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format(n);
}
