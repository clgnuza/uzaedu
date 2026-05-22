import type { CampaignType } from './entities/messaging-campaign.entity';

export const PDF_ATTACHMENT_TYPES = new Set<CampaignType>([
  'karne',
  'ara_karne',
  'devamsizlik_mektup',
  'mebbis_puantaj',
  'ek_ders_bordro',
  'maas_bordro',
]);

/** Bilgilendirme — SMS uygun (PDF yok). */
export const SMS_FRIENDLY_TYPES = new Set<CampaignType>([
  'devamsizlik',
  'ders_devamsizlik',
  'izin',
  'toplu_mesaj',
  'grup_mesaj',
  'veli_toplantisi',
  'davetiye',
  'ek_ders',
  'maas',
]);

export function campaignHasPdfAttachment(
  type: CampaignType,
  attachmentPath?: string | null,
  perRecipientPdf?: boolean,
): boolean {
  if (perRecipientPdf) return true;
  if (attachmentPath) return true;
  return PDF_ATTACHMENT_TYPES.has(type);
}

export function allowedChannels(
  type: CampaignType,
  hasPdf: boolean,
): Array<'whatsapp' | 'sms'> {
  if (hasPdf) return ['whatsapp'];
  if (SMS_FRIENDLY_TYPES.has(type)) return ['whatsapp', 'sms'];
  return ['whatsapp', 'sms'];
}

export function defaultChannelForCampaign(
  type: CampaignType,
  hasPdf: boolean,
  smsReady: boolean,
  whatsappReady: boolean,
): 'whatsapp' | 'sms' {
  const allowed = allowedChannels(type, hasPdf);
  if (hasPdf || !allowed.includes('sms')) return 'whatsapp';
  if (smsReady && !whatsappReady) return 'sms';
  if (whatsappReady) return 'whatsapp';
  return 'sms';
}
