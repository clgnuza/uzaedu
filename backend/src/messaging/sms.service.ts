import { Injectable, Logger } from '@nestjs/common';
import type { SmsConfig } from './sms-config';

export type SmsSendResult = {
  success: boolean;
  messageId?: string;
  error?: string;
};

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  async sendText(
    config: SmsConfig,
    to: string,
    text: string,
    headerOverride?: string,
  ): Promise<SmsSendResult> {
    const msgheader = (headerOverride ?? config.header).trim();
    if (!msgheader) return { success: false, error: 'SMS başlığı (gönderici adı) tanımlı değil' };
    const body = (text ?? '').trim();
    if (!body) return { success: false, error: 'Mesaj metni boş' };

    switch (config.provider) {
      case 'mock':
        return this._mockSend(to, body, msgheader);
      case 'netgsm':
        return this._netgsmSend(config, to, body, msgheader);
      default:
        return { success: false, error: 'Bilinmeyen SMS sağlayıcı' };
    }
  }

  private _normalizeGsm(phone: string): string {
    let d = String(phone).replace(/\D/g, '');
    if (d.startsWith('0')) d = '90' + d.slice(1);
    if (d.length === 10 && !d.startsWith('90')) d = '90' + d;
    return d.length >= 10 ? d : '';
  }

  private async _mockSend(to: string, text: string, header: string): Promise<SmsSendResult> {
    const gsm = this._normalizeGsm(to);
    if (!gsm) return { success: false, error: 'Geçersiz telefon' };
    this.logger.log(`[MOCK SMS] ${header} → ${gsm}: ${text.slice(0, 60)}...`);
    await new Promise((r) => setTimeout(r, 60));
    return { success: true, messageId: `mock_sms_${Date.now()}` };
  }

  /** Netgsm REST JSON — https://www.netgsm.com.tr/dokuman */
  private async _netgsmSend(
    config: SmsConfig,
    to: string,
    text: string,
    msgheader: string,
  ): Promise<SmsSendResult> {
    const gsm = this._normalizeGsm(to);
    if (!gsm) return { success: false, error: 'Geçersiz telefon numarası' };
    if (!config.usercode || !config.password) {
      return { success: false, error: 'Netgsm kullanıcı adı veya şifre eksik' };
    }

    const iysfilter = config.iys ? (config.iysList === 'TACIR' ? '12' : '11') : '0';
    const payload: Record<string, unknown> = {
      usercode: config.usercode,
      password: config.password,
      msgheader,
      encoding: config.encoding === 'TR' ? 'TR' : undefined,
      iysfilter,
      messages: [{ msg: text, no: gsm }],
    };

    try {
      const res = await fetch('https://api.netgsm.com.tr/sms/send/json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const raw = await res.text();
      let json: Record<string, unknown> = {};
      try {
        json = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        if (raw.trim() === '00' || raw.startsWith('00 ')) {
          return { success: true, messageId: raw.trim() };
        }
        return { success: false, error: raw.slice(0, 200) || `HTTP ${res.status}` };
      }

      const code = String(json.code ?? json.status ?? '').trim();
      if (code === '00' || code === '0') {
        const jobid = json.jobid ?? json.batchid ?? json.id;
        return { success: true, messageId: jobid != null ? String(jobid) : undefined };
      }
      const err = json.description ?? json.error ?? json.message ?? json.code;
      return { success: false, error: String(err ?? raw).slice(0, 300) };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }
}
