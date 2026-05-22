import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, timingSafeEqual } from 'crypto';
import { Repository } from 'typeorm';
import { MessagingSettings } from './entities/messaging-settings.entity';
import { MessagingRecipient } from './entities/messaging-recipient.entity';
import { MessagingDeliveryEvent } from './entities/messaging-delivery-event.entity';
import { MessagingInboundMessage } from './entities/messaging-inbound-message.entity';
import { MessagingCampaign } from './entities/messaging-campaign.entity';
import { MessagingSchoolNeedsService } from './messaging-school-needs.service';

@Injectable()
export class MessagingWebhookService {
  private readonly logger = new Logger(MessagingWebhookService.name);

  constructor(
    @InjectRepository(MessagingSettings)
    private readonly settingsRepo: Repository<MessagingSettings>,
    @InjectRepository(MessagingRecipient)
    private readonly recipientRepo: Repository<MessagingRecipient>,
    @InjectRepository(MessagingDeliveryEvent)
    private readonly deliveryRepo: Repository<MessagingDeliveryEvent>,
    @InjectRepository(MessagingInboundMessage)
    private readonly inboundRepo: Repository<MessagingInboundMessage>,
    @InjectRepository(MessagingCampaign)
    private readonly campaignRepo: Repository<MessagingCampaign>,
    private readonly schoolNeeds: MessagingSchoolNeedsService,
  ) {}

  verifyMetaSignature(rawBody: Buffer | string, signatureHeader: string | undefined, appSecret: string): boolean {
    if (!signatureHeader?.startsWith('sha256=') || !appSecret) return false;
    const expected = createHmac('sha256', appSecret).update(rawBody).digest('hex');
    const received = signatureHeader.slice(7);
    try {
      return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(received, 'hex'));
    } catch {
      return false;
    }
  }

  async resolveSchoolByMetaPhoneNumberId(phoneNumberId: string): Promise<string | null> {
    const rows = await this.settingsRepo.find({ where: { provider: 'meta', isActive: true } });
    for (const s of rows) {
      if (s.phoneNumberId === phoneNumberId) return s.schoolId;
    }
    return null;
  }

  async handleMetaWebhook(body: Record<string, unknown>): Promise<void> {
    const entries = (body.entry as Array<Record<string, unknown>> | undefined) ?? [];
    for (const entry of entries) {
      const changes = (entry.changes as Array<Record<string, unknown>> | undefined) ?? [];
      for (const change of changes) {
        const value = (change.value as Record<string, unknown>) ?? {};
        const meta = (value.metadata as Record<string, unknown>) ?? {};
        const phoneNumberId = String(meta.phone_number_id ?? '');
        if (!phoneNumberId) continue;
        const schoolId = await this.resolveSchoolByMetaPhoneNumberId(phoneNumberId);
        if (!schoolId) {
          this.logger.warn(`Meta webhook: phone_number_id ${phoneNumberId} için okul bulunamadı`);
          continue;
        }

        const statuses = (value.statuses as Array<Record<string, unknown>> | undefined) ?? [];
        for (const st of statuses) {
          await this._applyDeliveryStatus(schoolId, 'meta', st, value);
        }

        const messages = (value.messages as Array<Record<string, unknown>> | undefined) ?? [];
        const contacts = (value.contacts as Array<Record<string, unknown>> | undefined) ?? [];
        for (const msg of messages) {
          await this._storeInbound(schoolId, 'meta', msg, contacts, value);
        }
      }
    }
  }

  private async _applyDeliveryStatus(
    schoolId: string,
    provider: string,
    st: Record<string, unknown>,
    raw: Record<string, unknown>,
  ): Promise<void> {
    const extId = String(st.id ?? '');
    const status = String(st.status ?? '').toLowerCase();
    if (!extId || !status) return;

    const recipient = await this.recipientRepo.findOne({ where: { providerMessageId: extId } });
    if (recipient) {
      if (status === 'delivered') {
        recipient.deliveryStatus = 'delivered';
        recipient.deliveredAt = recipient.deliveredAt ?? new Date(Number(st.timestamp) * 1000 || Date.now());
      } else if (status === 'read') {
        recipient.deliveryStatus = 'read';
        recipient.readAt = new Date(Number(st.timestamp) * 1000 || Date.now());
      } else if (status === 'failed') {
        recipient.deliveryStatus = 'failed';
        recipient.errorMsg = String((st.errors as Array<{ title?: string }>)?.[0]?.title ?? 'Webhook: failed');
      }
      await this.recipientRepo.save(recipient);
    }

    await this.deliveryRepo.save(
      this.deliveryRepo.create({
        schoolId,
        campaignId: recipient?.campaignId ?? null,
        recipientId: recipient?.id ?? null,
        provider,
        externalMessageId: extId,
        status,
        rawPayload: { status: st, value: raw },
      }),
    );
  }

  private async _storeInbound(
    schoolId: string,
    provider: string,
    msg: Record<string, unknown>,
    contacts: Array<Record<string, unknown>>,
    raw: Record<string, unknown>,
  ): Promise<void> {
    const from = String(msg.from ?? '');
    if (!from) return;
    const phone = from.startsWith('90') ? from : `90${from}`;
    const extId = String(msg.id ?? '');
    const existing = extId
      ? await this.inboundRepo.findOne({ where: { schoolId, externalMessageId: extId } })
      : null;
    if (existing) return;

    const contact = contacts.find((c) => String(c.wa_id) === from);
    const senderName = contact?.profile
      ? String((contact.profile as Record<string, unknown>).name ?? '')
      : null;
    const type = String(msg.type ?? 'text');
    let body: string | null = null;
    if (type === 'text') {
      body = String((msg.text as Record<string, unknown>)?.body ?? '');
    } else {
      body = `[${type} mesajı]`;
    }

    await this.inboundRepo.save(
      this.inboundRepo.create({
        schoolId,
        phone,
        senderName: senderName || null,
        body,
        provider,
        externalMessageId: extId || null,
        messageType: type,
        rawPayload: { message: msg, value: raw },
        receivedAt: new Date(Number(msg.timestamp) * 1000 || Date.now()),
      }),
    );
    if (body) {
      await this.schoolNeeds.tryParseRsvpFromInbound(schoolId, phone, body);
    }
  }

  /** Twilio status callback (form-urlencoded parsed to object) */
  async handleTwilioStatus(schoolId: string, payload: Record<string, string>): Promise<void> {
    const extId = payload.MessageSid ?? '';
    const status = (payload.MessageStatus ?? payload.SmsStatus ?? '').toLowerCase();
    if (!extId) return;
    await this._applyDeliveryStatus(
      schoolId,
      'twilio',
      { id: extId, status: status === 'undelivered' ? 'failed' : status },
      payload as unknown as Record<string, unknown>,
    );
  }

  async resolveSchoolByTwilioAccountSid(accountSid: string): Promise<string | null> {
    const rows = await this.settingsRepo.find({ where: { provider: 'twilio', isActive: true } });
    for (const s of rows) {
      if (s.apiKey === accountSid) return s.schoolId;
    }
    return null;
  }
}
