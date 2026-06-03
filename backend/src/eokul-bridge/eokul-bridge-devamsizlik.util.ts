import type { ParsedRecipient } from '../messaging/parsers/excel-parsers';
import type { DevamsizlikOgrenciDto, DevamsizlikSinifDto } from './dto/devamsizlik-import.dto';

export function formatEokulTarihTr(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim());
  if (!m) return String(iso || '').trim();
  return `${m[3]}.${m[2]}.${m[1]}`;
}

export function eokulDevamsizlikTurLabel(st: DevamsizlikOgrenciDto): string {
  const parts: string[] = [];
  if (st.tam_gun) parts.push('Tam gün');
  if (st.yarim_sabah) parts.push('Yarım gün (sabah)');
  if (st.yarim_oglen) parts.push('Yarım gün (öğle)');
  if (st.gec) parts.push('Geç');
  if (st.nobet) parts.push('Nöbetçi');
  return parts.length ? parts.join(', ') : 'Özürsüz';
}

export function flattenEokulDevamsizlikSiniflar(siniflar: DevamsizlikSinifDto[]): DevamsizlikOgrenciDto[] {
  const out: DevamsizlikOgrenciDto[] = [];
  for (const g of siniflar || []) {
    const cls = String(g.sinif_adi || '').trim();
    for (const st of g.ogrenciler || []) {
      out.push({
        ...st,
        sinif_sube: st.sinif_sube || cls,
      });
    }
  }
  return out;
}

export function buildGunlukRecipients(
  students: DevamsizlikOgrenciDto[],
  template: string,
  tarihTr: string,
  phoneByStudentNo: Map<string, { phone: string; contactName: string | null }>,
): { recipients: ParsedRecipient[]; skippedNoPhone: number } {
  const recipients: ParsedRecipient[] = [];
  let skippedNoPhone = 0;
  let order = 0;
  for (const st of students) {
    const stuNo = String(st.ogrenci_no || '').trim();
    const stuName = String(st.ad_soyad || '').trim();
    const cls = String(st.sinif_sube || '').trim();
    if (!stuNo || !stuName) continue;
    const veli = phoneByStudentNo.get(stuNo);
    if (!veli?.phone) {
      skippedNoPhone += 1;
      continue;
    }
    const parent = veli.contactName?.trim() || `${stuName} Velisi`;
    const tur = eokulDevamsizlikTurLabel(st);
    const msg = template
      .replace('{AD}', parent)
      .replace('{OGRENCI}', stuName)
      .replace('{SINIF}', cls)
      .replace('{TARIH}', tarihTr)
      .replace('{TUR}', tur)
      .replace('{GUN}', '1 gün');
    recipients.push({
      recipientName: parent,
      phone: veli.phone,
      studentName: stuName,
      studentNumber: stuNo,
      className: cls,
      messageText: msg,
      sortOrder: order++,
    });
  }
  return { recipients, skippedNoPhone };
}

export function buildDersDevamsizlikRecipients(
  students: DevamsizlikOgrenciDto[],
  template: string,
  tarihTr: string,
  phoneByStudentNo: Map<string, { phone: string; contactName: string | null }>,
): { recipients: ParsedRecipient[]; skippedNoPhone: number } {
  const grouped = new Map<
    string,
    { stuName: string; cls: string; parent: string; phone: string; dersler: string[] }
  >();
  let skippedNoPhone = 0;

  for (const st of students) {
    const stuNo = String(st.ogrenci_no || '').trim();
    const stuName = String(st.ad_soyad || '').trim();
    const cls = String(st.sinif_sube || '').trim();
    const ders = String(st.ders_yoklama || '').trim();
    if (!stuNo || !stuName) continue;
    const veli = phoneByStudentNo.get(stuNo);
    if (!veli?.phone) {
      skippedNoPhone += 1;
      continue;
    }
    const key = veli.phone;
    if (!grouped.has(key)) {
      grouped.set(key, {
        stuName,
        cls,
        parent: veli.contactName?.trim() || `${stuName} Velisi`,
        phone: veli.phone,
        dersler: [],
      });
    }
    const g = grouped.get(key)!;
    if (ders && !g.dersler.includes(ders)) g.dersler.push(ders);
  }

  const recipients: ParsedRecipient[] = [];
  let order = 0;
  for (const g of grouped.values()) {
    const inline = g.dersler.length ? g.dersler.join(', ') : 'Belirtilmemiş';
    const msg = template
      .replace('{AD}', g.parent)
      .replace('{OGRENCI}', g.stuName)
      .replace('{SINIF}', g.cls)
      .replace('{TARIH}', tarihTr)
      .replace('{DERSLER_INLINE}', inline);
    recipients.push({
      recipientName: g.parent,
      phone: g.phone,
      studentName: g.stuName,
      className: g.cls,
      messageText: msg,
      sortOrder: order++,
    });
  }
  return { recipients, skippedNoPhone };
}
