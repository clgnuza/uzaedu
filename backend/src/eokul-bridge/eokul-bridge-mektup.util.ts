import type { MektupOgrenciDto } from './dto/mektup-import.dto';

export type MektupPrefillRecipient = {
  name: string;
  phone: string;
  studentName: string;
  studentNumber: string;
  className: string;
};

export function buildMektupPrefillRecipients(
  rows: MektupOgrenciDto[],
  phoneByStudentNo: Map<string, { phone: string; contactName: string | null }>,
): { recipients: MektupPrefillRecipient[]; skippedNoPhone: number } {
  const recipients: MektupPrefillRecipient[] = [];
  let skippedNoPhone = 0;
  for (const st of rows) {
    const no = String(st.ogrenci_no || '').trim();
    const name = String(st.ad_soyad || '').trim();
    const cls = String(st.sinif_adi || '').trim();
    if (!no || !name) continue;
    const veli = phoneByStudentNo.get(no);
    if (!veli?.phone) {
      skippedNoPhone += 1;
      continue;
    }
    recipients.push({
      name: veli.contactName?.trim() || `${name} Velisi`,
      phone: veli.phone,
      studentName: name,
      studentNumber: no,
      className: cls,
    });
  }
  return { recipients, skippedNoPhone };
}
