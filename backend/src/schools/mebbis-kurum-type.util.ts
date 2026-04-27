import { SchoolType } from '../types/enums';

/** MEB halka açık kurum adı + Excel «kurum türü» hücresi için TR→ASCII (pattern eşleşmesi) */
export function normalizeMebKurumKey(s: string): string {
  return String(s ?? '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/[ıİ]/g, 'i')
    .replace(/[şŞ]/g, 's')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[üÜ]/g, 'u')
    .replace(/[öÖ]/g, 'o')
    .replace(/[çÇ]/g, 'c');
}

/**
 * Sıra: en özden en genele (MEB okullar indeksi + Excel sütun değerleri).
 * Uçtan eşleşme: kaynak listeyle aynı ayrım.
 */
const MEB_KURUM_TYPE_RULES: ReadonlyArray<{ re: RegExp; type: SchoolType; filterLabel: string }> = [
  { re: /ogretmenevi ve aksam sanat okulu$/, type: SchoolType.ogretmenevi_aksam_sanat, filterLabel: 'Öğretmenevi ve Akşam Sanat Okulu' },
  { re: /rehberlik ve arastirma merkezi$/, type: SchoolType.rehberlik_merkezi, filterLabel: 'Rehberlik ve Araştırma Merkezi' },
  { re: /bilim ve sanat merkezi$/, type: SchoolType.bilsem, filterLabel: 'Bilim ve Sanat Merkezi' },
  { re: /halk egitimi merkezi$/, type: SchoolType.halk_egitim, filterLabel: 'Halk Eğitimi Merkezi' },
  { re: /mesleki egitim merkezi$/, type: SchoolType.mesleki_egitim_merkezi, filterLabel: 'Mesleki Eğitim Merkezi' },
  { re: /ozel egitim uygulama merkezi(?:si)?(?:.*kademe)?$/, type: SchoolType.ozel_egitim_uygulama_merkezi, filterLabel: 'Özel Eğitim Uygulama Merkezi' },
  { re: /ozel egitim uygulama okulu(?:.*kademe)?$/, type: SchoolType.ozel_egitim, filterLabel: 'Özel Eğitim Uygulama Okulu' },
  { re: /cok programli anadolu lisesi$/, type: SchoolType.cok_programli_anadolu_lisesi, filterLabel: 'Çok Programlı Anadolu Lisesi' },
  { re: /anadolu imam hatip lisesi$/, type: SchoolType.imam_hatip_lise, filterLabel: 'Anadolu İmam Hatip Lisesi' },
  { re: /imam hatip lisesi$/, type: SchoolType.imam_hatip_lise, filterLabel: 'İmam Hatip Lisesi' },
  { re: /imam hatip ortaokulu$/, type: SchoolType.imam_hatip_ortaokul, filterLabel: 'İmam Hatip Ortaokulu' },
  { re: /mesleki ve teknik anadolu lisesi$/, type: SchoolType.meslek_lisesi, filterLabel: 'Mesleki ve Teknik Anadolu Lisesi' },
  { re: /sosyal bilimler lisesi$/, type: SchoolType.sosyal_bilimler_lisesi, filterLabel: 'Sosyal Bilimler Lisesi' },
  { re: /guzel sanatlar lisesi$/, type: SchoolType.guzel_sanatlar_lisesi, filterLabel: 'Güzel Sanatlar Lisesi' },
  { re: /muzik ve guzel sanat lisesi$/, type: SchoolType.guzel_sanatlar_lisesi, filterLabel: 'Güzel Sanatlar Lisesi' },
  { re: /spor lisesi$/i, type: SchoolType.spor_lisesi, filterLabel: 'Spor Lisesi' },
  { re: /fen lisesi$/, type: SchoolType.fen_lisesi, filterLabel: 'Fen Lisesi' },
  { re: /anadolu lisesi$/, type: SchoolType.anadolu_lisesi, filterLabel: 'Anadolu Lisesi' },
  { re: /acik ogretim lisesi$/, type: SchoolType.acik_ogretim_lisesi, filterLabel: 'Açık Öğretim Lisesi' },
  { re: /anaokulu$/, type: SchoolType.anaokul, filterLabel: 'Anaokulu' },
  { re: /ilkokulu$/, type: SchoolType.ilkokul, filterLabel: 'İlkokulu' },
  { re: /ilkogretim okulu$/, type: SchoolType.temel_egitim, filterLabel: 'İlköğretim Okulu' },
  { re: /temel egitim okulu$/, type: SchoolType.temel_egitim, filterLabel: 'Temel Eğitim Okulu' },
  { re: /ortaokulu$/, type: SchoolType.ortaokul, filterLabel: 'Ortaokulu' },
  { re: /lisesi$/, type: SchoolType.lise, filterLabel: 'Lise' },
  { re: /^lise$/, type: SchoolType.lise, filterLabel: 'Lise' },
  { re: /^ortao?kul$/, type: SchoolType.ortaokul, filterLabel: 'Ortaokul' },
  { re: /^ilkokul$/, type: SchoolType.ilkokul, filterLabel: 'İlkokul' },
  { re: /^anaokul$/, type: SchoolType.anaokul, filterLabel: 'Anaokul' },
  { re: /^temel egitim$/, type: SchoolType.temel_egitim, filterLabel: 'Temel eğitim' },
];

/** Sadece ad/kurum türü sütunundan: bilinen MEB ad kalıbı → SchoolType, yoksa `null` */
export function schoolTypeFromMebKurumName(name: string): SchoolType | null {
  const k = normalizeMebKurumKey(name);
  if (!k) return null;
  for (const { re, type } of MEB_KURUM_TYPE_RULES) {
    if (re.test(k)) return type;
  }
  return null;
}

/** MEB «kurum türü» açılır listesi: kaynak adıyla aynı sıra ve aynı filtre metni */
export function mebbisKurumFilterLabelFromKurumAdi(name: string): string | null {
  const k = normalizeMebKurumKey(name);
  if (!k) return null;
  for (const { re, filterLabel } of MEB_KURUM_TYPE_RULES) {
    if (re.test(k)) return filterLabel;
  }
  return null;
}

/** Açılır liste / filtre: sondan kalıp yoksa `schoolTypeFromMebKurumNameWithHeuristics` → kural etiketi */
export function mebbisKurumFilterLabelFromKurumAdiWithHeuristics(name: string): string | null {
  const direct = mebbisKurumFilterLabelFromKurumAdi(name);
  if (direct) return direct;
  const st = schoolTypeFromMebKurumNameWithHeuristics(name);
  const hit = MEB_KURUM_TYPE_RULES.find((r) => r.type === st);
  return hit?.filterLabel ?? null;
}

const COLUMN_TYPE_HINTS: ReadonlyArray<{ re: RegExp; type: SchoolType }> = [
  { re: /^imam.*hatip.*(lise|lisesi|lisesi$)/, type: SchoolType.imam_hatip_lise },
  { re: /^imam.*hatip.*ortaokul/, type: SchoolType.imam_hatip_ortaokul },
  { re: /anaokul|okul oncesi/, type: SchoolType.anaokul },
  { re: /^(ilkokul|ilkogretim okulu)$/, type: SchoolType.ilkokul },
  { re: /^ortaokul$/, type: SchoolType.ortaokul },
  { re: /mesleki egitim merkezi/, type: SchoolType.mesleki_egitim_merkezi },
  { re: /mesleki ve teknik|mtal/, type: SchoolType.meslek_lisesi },
  { re: /fen lise/, type: SchoolType.fen_lisesi },
  { re: /sosyal bilimler/, type: SchoolType.sosyal_bilimler_lisesi },
  { re: /cok programli/i, type: SchoolType.cok_programli_anadolu_lisesi },
  { re: /anadolu lise/, type: SchoolType.anadolu_lisesi },
  { re: /acik ogretim.*lise|acik ogretim$/, type: SchoolType.acik_ogretim_lisesi },
  { re: /guzel sanat|muzik ve guzel sanat/, type: SchoolType.guzel_sanatlar_lisesi },
  { re: /spor lise/, type: SchoolType.spor_lisesi },
  { re: /bilsem|bilim ve sanat merkez/, type: SchoolType.bilsem },
  { re: /halk egitim|hekm/, type: SchoolType.halk_egitim },
  { re: /rehberlik ve arastirma/, type: SchoolType.rehberlik_merkezi },
  { re: /ogretmenevi|aksam sanat/, type: SchoolType.ogretmenevi_aksam_sanat },
  { re: /ozel egitim uygulama merkez/, type: SchoolType.ozel_egitim_uygulama_merkezi },
  { re: /ozel egitim(?!.*uygulama merkez)/, type: SchoolType.ozel_egitim },
  { re: /(temel egitim|ilkogretim) okulu$|temel egitim$|ilkogretim$|1\s*[-–]\s*8 kademe$/, type: SchoolType.temel_egitim },
  { re: /^(lise|genel lise|düz lise|lise \(genel\))$/, type: SchoolType.lise },
];

function schoolTypeFromShortColumnValue(raw: string): SchoolType | null {
  const k = normalizeMebKurumKey(raw);
  if (!k) return null;
  for (const { re, type } of COLUMN_TYPE_HINTS) {
    if (re.test(k)) return type;
  }
  return null;
}

/**
 * Tüm cümle içi anahtar kelimeler (son çare; kurum adı eşleşmediyse).
 * «lise» kontrolü, imam hatip / anadolu / meslek türlerinden sonra gelir.
 */
function mapTypeLabelHeuristicFallback(label: string): SchoolType {
  const L = normalizeMebKurumKey(label);
  if (L.includes('rehberlik') && (L.includes('arastirma') || L.includes('merkez'))) return SchoolType.rehberlik_merkezi;
  if (L.includes('ogretmenevi') || (L.includes('ogretmenevi') && L.includes('aksam sanat'))) return SchoolType.ogretmenevi_aksam_sanat;
  if (L.includes('mesleki egitim merkezi')) return SchoolType.mesleki_egitim_merkezi;
  if (L.includes('anaokul') || L.includes('okul oncesi')) return SchoolType.anaokul;
  if (L.includes('ilkogretim') || (L.includes('ilk') && L.includes('ogretim') && L.includes('okul'))) return SchoolType.temel_egitim;
  if (L.includes('ilkokul')) return SchoolType.ilkokul;
  if (L.includes('imam') && L.includes('orta') && (L.includes('okul') || L.includes('ogretim') || L.endsWith('okulu'))) return SchoolType.imam_hatip_ortaokul;
  if (L.includes('ortaokul') && !L.includes('imam')) return SchoolType.ortaokul;
  if (L.includes('imam') && (L.includes('lise') || L.includes('lis '))) return SchoolType.imam_hatip_lise;
  if (L.includes('meslek') || L.includes('mtal') || L.includes('mesleki ve teknik')) return SchoolType.meslek_lisesi;
  if (L.includes('bilsem') || (L.includes('bilim') && L.includes('sanat') && L.includes('merkez'))) return SchoolType.bilsem;
  if (L.includes('halk') && L.includes('egitim')) return SchoolType.halk_egitim;
  if (L.includes('ozel egitim')) {
    if (L.includes('uygulama') && L.includes('merkez')) return SchoolType.ozel_egitim_uygulama_merkezi;
    return SchoolType.ozel_egitim;
  }
  if (L.includes('fen lisesi') || L.includes('fenlisesi')) return SchoolType.fen_lisesi;
  if (L.includes('sosyal bilim')) return SchoolType.sosyal_bilimler_lisesi;
  if (L.includes('cok programli') && L.includes('anadolu')) return SchoolType.cok_programli_anadolu_lisesi;
  if (L.includes('anadolu lise') || (L.includes('anadolu') && L.includes('lise'))) return SchoolType.anadolu_lisesi;
  if (L.includes('acik ogretim') && L.includes('lise')) return SchoolType.acik_ogretim_lisesi;
  if (L.includes('guzel sanat') || (L.includes('güzel') && L.includes('sanat') && L.includes('lise'))) return SchoolType.guzel_sanatlar_lisesi;
  if (L.includes('spor lise')) return SchoolType.spor_lisesi;
  if (L.includes('temel egitim') && L.includes('okul')) return SchoolType.temel_egitim;
  if (L.includes('lise')) return SchoolType.lise;
  return SchoolType.lise;
}

/**
 * Excel hücresi / tam kurum adı: önce sözlük, sonra kısa sütun ipucu, sonra kelime sezgisel.
 * MEB halka açık liste: `name` → önce `schoolTypeFromMebKurumName(name)`.
 */
export function schoolTypeFromMebKurumNameWithHeuristics(input: string): SchoolType {
  return schoolTypeFromMebKurumName(input) ?? schoolTypeFromShortColumnValue(input) ?? mapTypeLabelHeuristicFallback(input);
}

/**
 * Tüm kaynaklarda ortak: tam ad, Excel «kurum türü» metni, önizleme.
 * Öncelik: tam kurum adındaki sondan kalıp, sonra açık sütun, sonra heuristik.
 */
export function resolveTypeFromReconcileRow(name: string, typeColumnRaw: string | undefined | null): SchoolType {
  const tcol = (typeColumnRaw ?? '').trim();
  return schoolTypeFromMebKurumName(name) ?? (tcol ? schoolTypeFromMebKurumNameWithHeuristics(tcol) : null) ?? schoolTypeFromMebKurumNameWithHeuristics(name);
}
