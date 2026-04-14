import * as XLSX from 'xlsx';
import { SchoolSegment, SchoolStatus, SchoolType } from '../types/enums';
import { ReconcileSourceSchoolDto } from './dto/reconcile-schools.dto';

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
  name: ['kurum_adi', 'okul_adi', 'adi', 'kurum_adi_', 'name', 'okul'],
  institution_code: ['kurum_kodu', 'meb_kodu', 'kod', 'kurum_kodu_', 'institution_code', 'okul_kodu'],
  city: ['il', 'province'],
  district: ['ilce', 'ilce_adi', 'district'],
  type: ['kurum_turu', 'tur', 'okul_turu', 'ana_tur', 'type'],
  address: ['adres', 'acik_adres', 'address'],
  phone: ['telefon', 'tel', 'phone'],
  fax: ['faks', 'fax'],
  website_url: ['web', 'web_sitesi', 'website', 'internet_sitesi'],
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

function mapTypeLabel(label: string): SchoolType {
  const L = label.toLowerCase();
  if (L.includes('anaokul') || L.includes('okul öncesi')) return SchoolType.anaokul;
  if (L.includes('ilkokul')) return SchoolType.ilkokul;
  if (L.includes('ortaokul') && !L.includes('imam')) return SchoolType.ortaokul;
  if (L.includes('imam') && L.includes('orta')) return SchoolType.imam_hatip_ortaokul;
  if (L.includes('imam') && (L.includes('lise') || L.includes('lis'))) return SchoolType.imam_hatip_lise;
  if (L.includes('meslek') || L.includes('mtal') || L.includes('mesleki')) return SchoolType.meslek_lisesi;
  if (L.includes('bilsem')) return SchoolType.bilsem;
  if (L.includes('halk') && L.includes('egitim')) return SchoolType.halk_egitim;
  if (L.includes('özel eğitim') || L.includes('ozel egitim')) return SchoolType.ozel_egitim;
  if (L.includes('fen lisesi') || L.includes('fenlisesi')) return SchoolType.fen_lisesi;
  if (L.includes('sosyal bilim')) return SchoolType.sosyal_bilimler_lisesi;
  if (L.includes('anadolu lise') && L.includes('çok')) return SchoolType.cok_programli_anadolu_lisesi;
  if (L.includes('anadolu')) return SchoolType.anadolu_lisesi;
  if (L.includes('açık öğretim') || L.includes('acik ogretim')) return SchoolType.acik_ogretim_lisesi;
  if (L.includes('güzel sanat') || L.includes('guzel sanat')) return SchoolType.guzel_sanatlar_lisesi;
  if (L.includes('spor lise')) return SchoolType.spor_lisesi;
  if (L.includes('temel eğitim') || L.includes('temel egitim')) return SchoolType.temel_egitim;
  if (L.includes('lise')) return SchoolType.lise;
  return SchoolType.lise;
}

function mapSegment(owner: '1' | '2' | '3'): SchoolSegment {
  if (owner === '2') return SchoolSegment.ozel;
  return SchoolSegment.devlet;
}

/**
 * MEBBİS’ten inen .xlsx buffer → reconcile satırları.
 * `owner`: formdaki Özel/Resmi (1 resmi, 2 özel, 3 meb dışı).
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
    const codeRaw = pick(row, ALIASES.institution_code);
    const typeRaw = pick(row, ALIASES.type);
    const dto: ReconcileSourceSchoolDto = {
      name,
      type: typeRaw ? mapTypeLabel(typeRaw) : SchoolType.lise,
      segment,
      city: pick(row, ALIASES.city) || undefined,
      district: pick(row, ALIASES.district) || undefined,
      institution_code: codeRaw && /^\d{4,16}$/.test(codeRaw) ? codeRaw : undefined,
      address: pick(row, ALIASES.address) || undefined,
      phone: pick(row, ALIASES.phone) || undefined,
      fax: pick(row, ALIASES.fax) || undefined,
      website_url: pick(row, ALIASES.website_url) || undefined,
      institutional_email: pick(row, ALIASES.institutional_email) || undefined,
      principal_name: pick(row, ALIASES.principal_name) || undefined,
      status: SchoolStatus.aktif,
    };
    out.push(dto);
  }
  return out;
}
