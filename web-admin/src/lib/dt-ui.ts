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
  teklif_isteme: 'Teklif isteme yazısı',
  karar: 'Doğrudan temin kararı',
  sozlesme: 'Sözleşme taslağı',
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

export type DtDetailTabId = 'items' | 'quotes' | 'budget' | 'payments' | 'commission' | 'docs';

export const DT_DETAIL_TABS: Array<{
  id: DtDetailTabId;
  label: string;
  shortHint: string;
  activeClass: string;
  inactiveClass: string;
}> = [
  {
    id: 'items',
    label: 'İhtiyaç kalemleri',
    shortHint: 'Mal/hizmet satırları ve tahmini bedel.',
    activeClass: 'border-emerald-500 text-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/30 dark:text-emerald-100',
    inactiveClass: 'border-transparent text-muted-foreground hover:text-emerald-800 hover:bg-emerald-50/40 dark:hover:text-emerald-200',
  },
  {
    id: 'quotes',
    label: 'Teklifler',
    shortHint: 'Firmalardan gelen fiyatlar.',
    activeClass: 'border-sky-500 text-sky-900 bg-sky-50/80 dark:bg-sky-950/30 dark:text-sky-100',
    inactiveClass: 'border-transparent text-muted-foreground hover:text-sky-900 hover:bg-sky-50/40 dark:hover:text-sky-100',
  },
  {
    id: 'budget',
    label: 'Bütçe bloke',
    shortHint: 'Ödeme öncesi tutarı hesaptan ayırma.',
    activeClass: 'border-amber-500 text-amber-900 bg-amber-50/80 dark:bg-amber-950/30 dark:text-amber-100',
    inactiveClass: 'border-transparent text-muted-foreground hover:text-amber-900 hover:bg-amber-50/40',
  },
  {
    id: 'payments',
    label: 'Ödemeler',
    shortHint: 'Gerçekleşen ödeme kayıtları.',
    activeClass: 'border-lime-600 text-lime-900 bg-lime-50/80 dark:bg-lime-950/25 dark:text-lime-100',
    inactiveClass: 'border-transparent text-muted-foreground hover:text-lime-900 hover:bg-lime-50/40',
  },
  {
    id: 'commission',
    label: 'Kabul komisyonu',
    shortHint: 'Teslim ve kabul için komisyon.',
    activeClass: 'border-violet-500 text-violet-900 bg-violet-50/80 dark:bg-violet-950/30 dark:text-violet-100',
    inactiveClass: 'border-transparent text-muted-foreground hover:text-violet-900 hover:bg-violet-50/40',
  },
  {
    id: 'docs',
    label: 'Belgeler',
    shortHint: 'Üretilen Word çıktıları.',
    activeClass: 'border-slate-600 text-slate-900 bg-slate-100/90 dark:bg-slate-800/50 dark:text-slate-100',
    inactiveClass: 'border-transparent text-muted-foreground hover:text-slate-800 hover:bg-slate-100/50 dark:hover:text-slate-200',
  },
];

export const DT_SECTION_HINTS: Record<DtDetailTabId, string> = {
  items:
    'İhtiyaç kalemleri ve yaklaşık maliyet; piyasa araştırması ve onay belgesi süreçlerinizle uyumlu tutun. Aşağıdan kalem ekleyebilir veya otomatik karar / belge üretebilirsiniz.',
  quotes:
    'İstekli firmalara teklif kaydı açın; her kalem için birim fiyat girin. En uygun teklif seçimi kurumunuzun kararıdır.',
  budget:
    'Dosya için kullanılacak tutarı bütçe hesabında geçici olarak ayırır (bloke). İşlem bitince blokeyi kaldırın.',
  payments:
    'Ödeme emri öncesi platform kuralları (üstteki uyarılar) uygulanır. Tutar, teklif ve not alanlarını eksiksiz doldurun.',
  commission:
    'Mal / hizmet tesliminde görevlendirilecek kabul komisyonu bilgileri. Üye eklerken kullanıcıyı doğru seçtiğinizden emin olun.',
  docs:
    'Sistem tarafından üretilen şablon belgeler. İmzalanmadan önce okul şablon ve mevzuat kontrolünden geçirin.',
};
