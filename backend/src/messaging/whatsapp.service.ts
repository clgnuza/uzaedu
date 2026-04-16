/**
 * WhatsApp gönderme servisi — provider abstraction.
 * Desteklenen: mock | meta | twilio | netgsm | custom
 *
 * Meta Business Cloud API: https://developers.facebook.com/docs/whatsapp/cloud-api
 * Twilio WhatsApp: https://www.twilio.com/en-us/whatsapp
 * Netgsm WhatsApp: https://www.netgsm.com.tr
 */
import { Injectable, Logger } from '@nestjs/common';
import { MessagingSettings } from './entities/messaging-settings.entity';

export type WhatsAppSendResult = {
  success: boolean;
  messageId?: string;
  error?: string;
};

const INTERNAL_MESSAGING_EXTRA_KEYS = new Set([
  'policyComplianceAck',
  'policyComplianceAckAt',
  'waManualPolicyAck',
  'waManualPolicyAckAt',
  'complianceAckVersion',
]);

function stripInternalMessagingExtra(extra: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!extra) return {};
  const o: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(extra)) {
    if (!INTERNAL_MESSAGING_EXTRA_KEYS.has(k)) o[k] = v;
  }
  return o;
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  async sendText(settings: MessagingSettings, to: string, text: string): Promise<WhatsAppSendResult> {
    if (!settings.isActive) return { success: false, error: 'WhatsApp entegrasyonu aktif değil' };
    switch (settings.provider) {
      case 'whatsapp_link':
        return { success: false, error: 'Bu modda sunucudan gönderim yapılmaz; wa.me bağlantılarını kullanın.' };
      case 'mock':    return this._mockSend(to, text);
      case 'meta':    return this._metaSend(settings, to, text);
      case 'twilio':  return this._twilioSend(settings, to, text);
      case 'netgsm':  return this._netgsmSend(settings, to, text);
      case 'custom':  return this._customSend(settings, to, text);
      default:        return { success: false, error: 'Bilinmeyen sağlayıcı' };
    }
  }

  async sendDocument(settings: MessagingSettings, to: string, text: string, pdfBuffer: Buffer, filename: string): Promise<WhatsAppSendResult> {
    if (!settings.isActive) return { success: false, error: 'WhatsApp entegrasyonu aktif değil' };
    // Meta ve Twilio dosya gönderimini destekler; diğerleri metin + notla fallback
    switch (settings.provider) {
      case 'whatsapp_link':
        return { success: false, error: 'Bu modda sunucudan dosya gönderimi yok; wa.me veya API sağlayıcısı kullanın.' };
      case 'mock':   return this._mockSend(to, `[DOC: ${filename}] ${text}`);
      case 'meta':   return this._metaSendDoc(settings, to, text, pdfBuffer, filename);
      case 'twilio': return this._twilioSendDoc(settings, to, text, pdfBuffer, filename);
      default:       return this.sendText(settings, to, text + `\n\n[${filename} dosyası ektedir]`);
    }
  }

  // ── MOCK ──────────────────────────────────────────────────────────────────
  private async _mockSend(to: string, text: string): Promise<WhatsAppSendResult> {
    this.logger.log(`[MOCK] WhatsApp → ${to}: ${text.slice(0, 60)}...`);
    await new Promise((r) => setTimeout(r, 80)); // simüle gecikme
    return { success: true, messageId: `mock_${Date.now()}` };
  }

  // ── META BUSINESS CLOUD API ────────────────────────────────────────────────
  private async _metaSend(s: MessagingSettings, to: string, text: string): Promise<WhatsAppSendResult> {
    try {
      const url = `https://graph.facebook.com/v19.0/${s.phoneNumberId}/messages`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${s.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: to.replace('+', ''), type: 'text', text: { body: text } }),
      });
      const json = await res.json() as Record<string, unknown>;
      if (!res.ok) return { success: false, error: JSON.stringify(json) };
      const msgs = (json.messages as Array<{ id: string }> | undefined);
      return { success: true, messageId: msgs?.[0]?.id };
    } catch (e) { return { success: false, error: String(e) }; }
  }

  private async _metaSendDoc(s: MessagingSettings, to: string, caption: string, buf: Buffer, filename: string): Promise<WhatsAppSendResult> {
    try {
      // 1. Upload media
      const uploadUrl = `https://graph.facebook.com/v19.0/${s.phoneNumberId}/media`;
      const fd = new (await import('form-data')).default();
      fd.append('file', buf, { filename, contentType: 'application/pdf' });
      fd.append('type', 'application/pdf');
      fd.append('messaging_product', 'whatsapp');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const upRes = await fetch(uploadUrl, { method: 'POST', headers: { Authorization: `Bearer ${s.apiKey}`, ...fd.getHeaders() }, body: fd.getBuffer() as any });
      const upJson = await upRes.json() as { id: string };
      if (!upRes.ok) return { success: false, error: JSON.stringify(upJson) };
      // 2. Send document
      const msgUrl = `https://graph.facebook.com/v19.0/${s.phoneNumberId}/messages`;
      const res = await fetch(msgUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${s.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: to.replace('+', ''), type: 'document', document: { id: upJson.id, caption, filename } }),
      });
      const json = await res.json() as Record<string, unknown>;
      if (!res.ok) return { success: false, error: JSON.stringify(json) };
      return { success: true, messageId: String(json.messages) };
    } catch (e) { return { success: false, error: String(e) }; }
  }

  // ── TWILIO ────────────────────────────────────────────────────────────────
  private async _twilioSend(s: MessagingSettings, to: string, text: string): Promise<WhatsAppSendResult> {
    try {
      const accountSid = s.apiKey;
      const authToken  = s.apiSecret;
      const from       = `whatsapp:${s.fromNumber}`;
      const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
      const params = new URLSearchParams({ From: from, To: `whatsapp:${to}`, Body: text });
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
      });
      const json = await res.json() as { sid?: string; message?: string };
      if (!res.ok) return { success: false, error: json.message ?? JSON.stringify(json) };
      return { success: true, messageId: json.sid };
    } catch (e) { return { success: false, error: String(e) }; }
  }

  private async _twilioSendDoc(s: MessagingSettings, to: string, caption: string, buf: Buffer, filename: string): Promise<WhatsAppSendResult> {
    // Twilio requires publicly accessible media URL; fallback to text with note
    return this._twilioSend(s, to, caption + `\n\n[${filename}]`);
  }

  // ── NETGSM ────────────────────────────────────────────────────────────────
  private async _netgsmSend(s: MessagingSettings, to: string, text: string): Promise<WhatsAppSendResult> {
    try {
      const endpoint = s.apiEndpoint ?? 'https://api.netgsm.com.tr/whatsapp/send/text';
      const body = { apikey: s.apiKey, apisecret: s.apiSecret, receiver: to.replace('+', ''), contenttype: 1, gsm: to.replace('+', ''), message: text };
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json() as { code?: string; msgid?: string; error?: string };
      if (json.code !== '00') return { success: false, error: json.error ?? json.code };
      return { success: true, messageId: json.msgid };
    } catch (e) { return { success: false, error: String(e) }; }
  }

  // ── CUSTOM ────────────────────────────────────────────────────────────────
  private async _customSend(s: MessagingSettings, to: string, text: string): Promise<WhatsAppSendResult> {
    if (!s.apiEndpoint) return { success: false, error: 'API endpoint tanımlı değil' };
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (s.apiKey) headers['Authorization'] = `Bearer ${s.apiKey}`;
      const res = await fetch(s.apiEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ to, text, ...stripInternalMessagingExtra(s.extraConfig) }),
      });
      if (!res.ok) return { success: false, error: `HTTP ${res.status}` };
      const json = await res.json() as { id?: string; messageId?: string };
      return { success: true, messageId: json.id ?? json.messageId };
    } catch (e) { return { success: false, error: String(e) }; }
  }
}
