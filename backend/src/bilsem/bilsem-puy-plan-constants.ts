/**
 * BİLSEM Coğrafya PÜY yıllık plan — yardımcı sütun varsayılanları (UTF-8).
 * Farklılaştırma / okul temelli: isteğe bağlı bağlam (ünite, konu, kazanım) ile kısa ve haftaya özel üretilir.
 */

const PUY_FIELD_MAX = 168;

export type BilsemPuyMergeContext = {
  unite?: string | null;
  konu?: string | null;
  /** Öğrenme çıktıları / kazanım metni */
  kazanimlar?: string | null;
};

function bilsemPuyShortSnippet(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1)).trim()}…`;
}

/** Boşsa ünite/konu/kazanıma göre kısa farklılaştırma ve okul temelli metin (mevcut değerleri ezmez). */
export function applyBilsemPuyZenginOkulFromContext(
  row: Record<string, unknown>,
  ctx: BilsemPuyMergeContext,
): void {
  const setIfEmpty = (key: string, value: string) => {
    const cur = String(row[key] ?? '').trim();
    if (!cur && value) row[key] = value.length > PUY_FIELD_MAX ? `${value.slice(0, PUY_FIELD_MAX - 1).trim()}…` : value;
  };

  const unite = String(ctx.unite ?? '').trim();
  const konu = String(ctx.konu ?? '').trim();
  const kaz = String(ctx.kazanimlar ?? '').trim();
  const kazFirst =
    kaz
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.length > 0) ?? '';

  const focus = konu || unite || bilsemPuyShortSnippet(kazFirst, 96);
  if (!focus) return;

  const f = bilsemPuyShortSnippet(focus, 78);
  const u = bilsemPuyShortSnippet(unite, 52);
  const k = bilsemPuyShortSnippet(konu, 52);

  setIfEmpty('zenginlestirme', `${f} — hazır bulunuş ve ilgiye göre görev, süreç ve ürün seçenekleri.`);

  if (u && k) {
    setIfEmpty('okul_temelli_planlama', `${u} · ${k} bağlamında okul önceliği ve yerel örnek.`);
  } else if (u) {
    setIfEmpty('okul_temelli_planlama', `${u} ünitesinde okul/yerel öncelik ve çevre örneği ile ilişkilendirme.`);
  } else {
    setIfEmpty('okul_temelli_planlama', `${bilsemPuyShortSnippet(focus, 88)} kazanımı için zümre/alan uygulaması.`);
  }
}

export const BILSEM_PUY_SOSYAL_DUYGUSAL =
  'Öz farkındalık/düzenleme/yansıtma; iletişim, iş birliği; uyum ve sorumlu karar verme.';

export const BILSEM_PUY_DEGERLER =
  'Saygı, sorumluluk, adalet, özgürlük, dürüstlük, vatanseverlik ve çatı değerlerle uyum.';

export const BILSEM_PUY_OKURYAZARLIK =
  'Bilgi, dijital, görsel, kültür/sanat/veri, vatandaşlık, sürdürülebilirlik, finansal, sistem, çevre–iklim, sağlık okuryazarlığı.';

/** work_calendar hafta sırasına göre belirli gün / hafta notları (yaklaşık PÜY planı) */
export function bilsemPuYBelirliGunForWeek(weekOrder: number): string {
  const m: Record<number, string> = {
    8: '29 Ekim Cumhuriyet Bayramı',
    10: '10 Kasım Atatürk’ü Anma, Gazi ve Şehitleri Anma Günü',
    11: '1. dönem ara tatili (yaklaşık 11–15 Kasım, takvime göre)',
    19: 'Yarıyıl tatili (yaklaşık 20 Ocak – 31 Ocak, takvime göre)',
    25: '2. dönem ara tatili (yaklaşık 31 Mart – 4 Nisan, takvime göre)',
    30: '23 Nisan Ulusal Egemenlik ve Çocuk Bayramı',
    31: '1 Mayıs Emek ve Dayanışma Günü',
    33: '19 Mayıs Atatürk’ü Anma, Gençlik ve Spor Bayramı',
  };
  return m[weekOrder] ?? '';
}

export function isBilsemSubjectCode(code: string | null | undefined): boolean {
  const c = (code ?? '').trim().toLowerCase();
  return c.startsWith('bilsem_') || c === 'bilsem';
}

/** Word/Excel merge satırında boş PÜY sütunlarını doldurur (mevcut değerleri ezmez). */
export function applyBilsemPuyMergeRowDefaults(
  row: Record<string, unknown>,
  weekOrder: number,
  ctx?: BilsemPuyMergeContext,
): void {
  const setIfEmpty = (key: string, value: string) => {
    if (!String(row[key] ?? '').trim() && value) {
      row[key] = value;
    }
  };
  setIfEmpty('sosyal_duygusal', BILSEM_PUY_SOSYAL_DUYGUSAL);
  setIfEmpty('degerler', BILSEM_PUY_DEGERLER);
  setIfEmpty('okuryazarlik_becerileri', BILSEM_PUY_OKURYAZARLIK);
  const belirli = bilsemPuYBelirliGunForWeek(weekOrder);
  if (belirli) setIfEmpty('belirli_gun_haftalar', belirli);
  if (ctx) applyBilsemPuyZenginOkulFromContext(row, ctx);
}
