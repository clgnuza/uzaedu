/** Doğrudan temin dosyası — sözleşme gövdesi (HTML) + seçili yüklenici. */

export const DT_SOZLESME_DRAFT_VERSION = 1 as const;

export type DtSozlesmeDraftV1 = {
  version: typeof DT_SOZLESME_DRAFT_VERSION;
  vendorId: string;
  bodyHtml: string;
};

const L400K = 400_000;

function trunc(s: string, n: number): string {
  const t = String(s ?? '');
  return t.length <= n ? t : t.slice(0, n);
}

export function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildDefaultSozlesmeBodyHtml(input: {
  schoolName: string;
  subject: string;
  year: number;
  fileNo: string;
  procurementRef: string;
  vendorTitle: string;
  vendorAddress: string;
  vendorTaxNo: string;
  totalFormatted: string;
  principalName: string;
}): string {
  const e = escapeHtml;
  const proc = input.procurementRef
    ? `<p><strong>Doğrudan temin numarası.</strong> ${e(input.procurementRef)}</p>`
    : '';
  return [
    `<p><strong>1. Amaç ve kapsam.</strong> Bu sözleşme, <strong>${e(input.subject)}</strong> kapsamında İdare ile Yüklenici arasındaki hak ve yükümlülükleri düzenler. Metin genel taslaktır; kurumunuzun hukuk ve mali iş birimlerinin onayı ile mevzuata uygunluk kontrolü zorunludur.</p>`,
    `<p><strong>2. Taraflar.</strong> <strong>İdare:</strong> ${e(input.schoolName)}. <strong>Yüklenici:</strong> ${e(input.vendorTitle)}.</p>`,
    `<p><strong>3. Dosya bilgileri.</strong> Yıl / dosya no: <strong>${e(String(input.year))}</strong> / <strong>${e(input.fileNo)}</strong>.</p>`,
    proc,
    `<p><strong>4. Yüklenici bilgileri.</strong> Unvan: ${e(input.vendorTitle)}; adres: ${e(input.vendorAddress || '—')}; vergi kimlik no: ${e(input.vendorTaxNo || '—')}.</p>`,
    `<p><strong>5. Bedel (KDV hariç).</strong> Sözleşme toplamı <strong>${e(input.totalFormatted)} TL</strong> olup, yukarıdaki kalem cetveli ile aynı olmalıdır.</p>`,
    `<p><strong>6. Ödeme ve teslimat.</strong> Ödeme vadeleri, teslim yeri ve süreleri taraflarca yazılı olarak veya ek protokolle belirlenir.</p>`,
    `<p><strong>7. Ceza ve mücbir sebep.</strong> Gecikme, aykırılık ve mücbir sebep hükümleri ilgili mevzuat ile idari şartnameye tabidir.</p>`,
    `<p><strong>8. Uyuşmazlık.</strong> Bu sözleşmeden doğan uyuşmazlıklarda <em>[yetkili mahkeme ve icra dairesi yazılacaktır]</em> yetkilidir.</p>`,
    `<p><strong>9. Yürürlük ve imza.</strong> İşbu sözleşme <strong>___.___.____</strong> tarihinde iki nüsha olarak düzenlenmiş, taraflarca imza altına alınmıştır.</p>`,
    `<p><strong>İdare adına</strong></p>`,
    `<p>${e(input.principalName || 'Ad Soyad')}</p>`,
    `<p>İmza / mühür: ______________________ &nbsp;&nbsp; Tarih: _______________</p>`,
    `<p><strong>Yüklenici adına</strong> (${e(input.vendorTitle)})</p>`,
    `<p>İmza / kaşe: ______________________ &nbsp;&nbsp; Tarih: _______________</p>`,
  ].join('\n');
}

export function normalizeDtSozlesmeDraft(vendorId: string, bodyHtml: string): DtSozlesmeDraftV1 {
  return {
    version: DT_SOZLESME_DRAFT_VERSION,
    vendorId: String(vendorId ?? '').trim(),
    bodyHtml: trunc(String(bodyHtml ?? ''), L400K),
  };
}
