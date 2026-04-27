import * as XLSX from 'xlsx';
import { SchoolSegment, SchoolStatus, SchoolType } from '../types/enums';
import { ReconcileSourceSchoolDto } from './dto/reconcile-schools.dto';
import { resolveTypeFromReconcileRow, schoolTypeFromMebKurumNameWithHeuristics } from './mebbis-kurum-type.util';

function normHeader(s: string): string {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[ıİ]/g, 'i')
    .replace(/[şŞ]/g, 's')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[üÜ]/g, 'u')
    .replace(/[öÖ]/g, 'o')
    .replace(/[çÇ]/g, 'c');
}

/** MEB / mebbis Excel sütun eşlemesi (başlık varyasyonları). */
const ALIASES: Record<string, string[]> = {
  name: ['kurum_adi', 'okul_adi', 'adi', 'kurum_adi_', 'name', 'okul', 'kurumun_adi'],
  institution_code: [
    'kurum_kodu',
    'meb_kodu',
    'kod',
    'kurum_kodu_',
    'institution_code',
    'okul_kodu',
    'kurum_kimlik_numarasi',
    'kurum_kimlik',
    'meb_kurum_kodu',
    'kurum_no',
    'kurum_numarasi',
    'b_kurum_kodu',
    'kurumkodu',
    'mebkodu',
    'kurum_kodu_bilgisi',
    /** MEBBİS liste ekranı (HTML/Excel) — kurum anahtarı genelde burada */
    'mernis_adres_kodu',
    'mernis',
    'mernis_kodu',
    'mernis_adres',
    'adres_kodu',
  ],
  city: ['il', 'province'],
  district: ['ilce', 'ilce_adi', 'district'],
  type: ['kurum_turu', 'tur', 'okul_turu', 'ana_tur', 'type'],
  address: ['adres', 'acik_adres', 'address'],
  phone: ['telefon', 'tel', 'phone'],
  fax: ['faks', 'fax'],
  website_url: ['web', 'web_sitesi', 'website', 'internet_sitesi', 'web_adres', 'web_adresi', 'internet_adresi'],
  institutional_email: ['e-posta', 'eposta', 'kurumsal_eposta', 'email', 'institutional_email'],
  principal_name: ['mudur', 'mudur_adi', 'principal', 'principal_name'],
};

function pick(row: Record<string, unknown>, keys: string[]): string {
  const rk = Object.keys(row);
  for (const want of keys) {
    const n = normHeader(want);
    for (const k of rk) {
      if (normHeader(k) === n) {
        const v = row[k];
        if (v == null || v === '') continue;
        return String(v).trim();
      }
    }
  }
  for (const alias of keys) {
    const na = normHeader(alias);
    for (const k of rk) {
      if (normHeader(k).includes(na) || na.includes(normHeader(k))) {
        const v = row[k];
        if (v == null || v === '') continue;
        return String(v).trim();
      }
    }
  }
  return '';
}

/** Excel tek hücre / kısa metin (MEBBİS kurum türü sütunu) */
export function mapTypeLabel(label: string): SchoolType {
  return schoolTypeFromMebKurumNameWithHeuristics(label);
}

function mapSegment(owner: '1' | '2' | '3'): SchoolSegment {
  if (owner === '2') return SchoolSegment.ozel;
  return SchoolSegment.devlet;
}

/** Hücredeki metinden 4–16 haneli MEB kurum kodu çıkar (boşluk, tire, .0 vb. temizlenir). */
function parseInstitutionCode(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const digits = String(raw).trim().replace(/\D/g, '');
  return /^\d{4,16}$/.test(digits) ? digits : undefined;
}

/** Başlıkta "kod" / mernis geçen sütunlardan kurum kodu tahmini (pick başarısızsa). */
function inferInstitutionCodeFromRow(row: Record<string, unknown>): string | undefined {
  for (const [k, v] of Object.entries(row)) {
    const nk = normHeader(k);
    if (!nk.includes('mernis')) continue;
    const parsed = parseInstitutionCode(String(v ?? ''));
    if (parsed) return parsed;
  }
  for (const [k, v] of Object.entries(row)) {
    const nk = normHeader(k);
    if (!nk.includes('kod') && !nk.includes('code')) continue;
    if (nk.includes('posta') || nk.includes('telefon') || nk.includes('fax') || nk.includes('tel')) continue;
    const parsed = parseInstitutionCode(String(v ?? ''));
    if (parsed) return parsed;
  }
  return undefined;
}

function normalizeWebUrl(raw: string | undefined): string | undefined {
  const t = raw?.trim();
  if (!t) return undefined;
  const u = t.replace(/^mailto:/i, '').trim();
  if (/^https?:\/\//i.test(u)) return u.slice(0, 512);
  if (!/\s/.test(u) && !u.includes('@') && u.includes('.') && u.length >= 4) return `https://${u}`.slice(0, 512);
  return undefined;
}

/**
 * MEBBİS’ten inen .xlsx buffer → reconcile satırları.
 * `owner`: formdaki Özel/Resmi (1 resmi, 2 özel, 3 meb dışı).
 * Tür: önce tam okul adı, sonra «kurum türü» sütunu, sonra sözlük+sezgi.
 */
export function mebbisWorkbookBufferToSchools(buf: Buffer, owner: '1' | '2' | '3'): ReconcileSourceSchoolDto[] {
  const wb = XLSX.read(buf, { type: 'buffer' });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  const segment = mapSegment(owner);
  const out: ReconcileSourceSchoolDto[] = [];
  for (const row of rows) {
    const name = pick(row, ALIASES.name);
    if (!name) continue;
    const codePick = pick(row, ALIASES.institution_code);
    const codeRaw = parseInstitutionCode(codePick) ?? inferInstitutionCodeFromRow(row);
    const typeRaw = pick(row, ALIASES.type);
    const dto: ReconcileSourceSchoolDto = {
      name,
      type: resolveTypeFromReconcileRow(name, typeRaw),
      segment,
      city: pick(row, ALIASES.city) || undefined,
      district: pick(row, ALIASES.district) || undefined,
      institution_code: codeRaw,
      address: pick(row, ALIASES.address) || undefined,
      phone: pick(row, ALIASES.phone) || undefined,
      fax: pick(row, ALIASES.fax) || undefined,
      website_url: normalizeWebUrl(pick(row, ALIASES.website_url)),
      institutional_email: pick(row, ALIASES.institutional_email) || undefined,
      principal_name: pick(row, ALIASES.principal_name) || undefined,
      status: SchoolStatus.aktif,
    };
    out.push(dto);
  }
  return out;
}
