import type { ParsedRecipient } from '../messaging/parsers/excel-parsers';

export type IzinRowInput = {
  ogrenci_no?: string;
  ad_soyad: string;
  sinif_adi?: string;
  izin_turu?: string;
  cikis?: string;
  donus?: string;
};

export function buildIzinCampaignRecipients(
  rows: IzinRowInput[],
  tpl: string,
  tarihTr: string,
  phoneMap: Map<string, { phone: string; contactName: string | null }>,
): { recipients: ParsedRecipient[]; skippedNoPhone: number } {
  const recipients: ParsedRecipient[] = [];
  let skippedNoPhone = 0;
  let order = 0;

  for (const row of rows) {
    const stuNo = String(row.ogrenci_no || '').trim();
    const stuName = String(row.ad_soyad || '').trim();
    if (!stuName) continue;
    const cls = String(row.sinif_adi || '').trim();
    const type = String(row.izin_turu || 'Evci İzni').trim();
    const cikis = String(row.cikis || '').trim() || tarihTr;
    const donus = String(row.donus || '').trim() || '-';
    const veli = stuNo ? phoneMap.get(stuNo) : undefined;
    if (!veli?.phone) {
      skippedNoPhone += 1;
      continue;
    }
    const parent = veli.contactName?.trim() || `${stuName} Velisi`;
    const msg = tpl
      .replace('{AD}', parent)
      .replace('{OGRENCI}', stuName)
      .replace('{SINIF}', cls)
      .replace('{TARIH}', cikis)
      .replace('{CIKIS}', cikis)
      .replace('{DONUS}', donus)
      .replace('{TUR}', type);
    recipients.push({
      recipientName: parent,
      phone: veli.phone,
      studentName: stuName,
      studentNumber: stuNo || undefined,
      className: cls,
      messageText: msg,
      sortOrder: order++,
    });
  }

  return { recipients, skippedNoPhone };
}
