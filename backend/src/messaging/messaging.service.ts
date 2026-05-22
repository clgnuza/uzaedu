import { BadRequestException, ForbiddenException, forwardRef, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, Repository } from 'typeorm';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { MessagingSettings } from './entities/messaging-settings.entity';
import { MessagingCampaign, CampaignType } from './entities/messaging-campaign.entity';
import { MessagingRecipient } from './entities/messaging-recipient.entity';
import { MessagingContactGroup } from './entities/messaging-contact-group.entity';
import { MessagingGroupMember } from './entities/messaging-group-member.entity';
import { MessagingUserPreference } from './entities/messaging-user-preference.entity';
import { MessagingTemplate } from './entities/messaging-template.entity';
import { MessagingOptOut } from './entities/messaging-opt-out.entity';
import { MessagingContactPreference } from './entities/messaging-contact-preference.entity';
import { MessagingDeliveryEvent } from './entities/messaging-delivery-event.entity';
import { MessagingInboundMessage } from './entities/messaging-inbound-message.entity';
import { WhatsAppService } from './whatsapp.service';
import { SmsService } from './sms.service';
import {
  allowedChannels,
  campaignHasPdfAttachment,
  defaultChannelForCampaign,
} from './messaging-channel-rules';
import {
  TPL_DEVAMSIZLIK,
  TPL_DERS_DEVAMSIZLIK,
  TPL_EK_DERS,
  TPL_IZIN,
  TPL_KARNE,
  TPL_MAAS,
  TPL_VELI_ILETISIM,
  TPL_VELI_TOPLANTISI,
  TPL_ACIL,
  TPL_DAVETIYE,
} from './default-message-templates';
import { mergeSmsIntoExtra, parseSmsConfig, smsConfigReady, type SmsConfig } from './sms-config';
import type { ExecuteCampaignDto } from './dto/messaging.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../types/enums';
import {
  parseTopluMesaj, parseEkDers, parseMaas,
  parseDevamsizlik, parseDersDevamsizlik, parseIzin, ParsedRecipient,
} from './parsers/excel-parsers';
import type { SaveSettingsDto, PatchTeacherMessagingPreferencesDto } from './dto/messaging.dto';
import { parseMebbisPuantaj, parseEkDersBordro, parseMaasBordro, BordroTeacher } from './parsers/bordro-parsers';
import { splitPdfByPageCount } from './parsers/pdf-splitter';
import { MessagingSchoolNeedsService } from './messaging-school-needs.service';

const UPLOADS_DIR = join(process.cwd(), 'uploads', 'messaging');

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(
    @InjectRepository(MessagingSettings)
    private readonly settingsRepo: Repository<MessagingSettings>,
    @InjectRepository(MessagingCampaign)
    private readonly campaignRepo: Repository<MessagingCampaign>,
    @InjectRepository(MessagingRecipient)
    private readonly recipientRepo: Repository<MessagingRecipient>,
    @InjectRepository(MessagingContactGroup)
    private readonly groupRepo: Repository<MessagingContactGroup>,
    @InjectRepository(MessagingGroupMember)
    private readonly memberRepo: Repository<MessagingGroupMember>,
    @InjectRepository(MessagingUserPreference)
    private readonly userPrefRepo: Repository<MessagingUserPreference>,
    @InjectRepository(MessagingTemplate)
    private readonly templateRepo: Repository<MessagingTemplate>,
    @InjectRepository(MessagingOptOut)
    private readonly optOutRepo: Repository<MessagingOptOut>,
    @InjectRepository(MessagingContactPreference)
    private readonly contactPrefRepo: Repository<MessagingContactPreference>,
    @InjectRepository(MessagingDeliveryEvent)
    private readonly deliveryRepo: Repository<MessagingDeliveryEvent>,
    @InjectRepository(MessagingInboundMessage)
    private readonly inboundRepo: Repository<MessagingInboundMessage>,
    private readonly wa: WhatsAppService,
    private readonly sms: SmsService,
    private readonly dataSource: DataSource,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly notificationsService: NotificationsService,
    @Inject(forwardRef(() => MessagingSchoolNeedsService))
    private readonly schoolNeeds: MessagingSchoolNeedsService,
  ) {
    if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  // ── Ayarlar ───────────────────────────────────────────────────────────────

  async getSettings(schoolId: string) {
    const s = await this.settingsRepo.findOne({ where: { schoolId } });
    if (!s || (s.provider as string) !== 'whatsapp_link') return s;
    return { ...s, provider: 'mock' as MessagingSettings['provider'], isActive: false };
  }

  async getTeacherMessagingPreferences(userId: string, schoolId: string): Promise<{
    appendSignature: string;
    openWaInNewTab: boolean;
  }> {
    const row = await this.userPrefRepo.findOne({ where: { userId, schoolId } });
    const p = (row?.preferences ?? {}) as Record<string, unknown>;
    return {
      appendSignature: typeof p.appendSignature === 'string' ? p.appendSignature : '',
      openWaInNewTab: p.openWaInNewTab !== false,
    };
  }

  async saveTeacherMessagingPreferences(
    userId: string,
    schoolId: string,
    dto: PatchTeacherMessagingPreferencesDto,
  ) {
    let row = await this.userPrefRepo.findOne({ where: { userId, schoolId } });
    if (!row) row = this.userPrefRepo.create({ userId, schoolId, preferences: {} });
    const cur: Record<string, unknown> = { ...(row.preferences as Record<string, unknown>) };
    if (dto.appendSignature !== undefined) cur.appendSignature = dto.appendSignature;
    if (dto.openWaInNewTab !== undefined) cur.openWaInNewTab = dto.openWaInNewTab;
    row.preferences = cur;
    await this.userPrefRepo.save(row);
    return this.getTeacherMessagingPreferences(userId, schoolId);
  }

  /** Kanal hazırlık durumu (gönderim paneli). */
  async getDeliveryHint(schoolId: string) {
    const s = await this.settingsRepo.findOne({ where: { schoolId } });
    const legacyLink = (s?.provider as string) === 'whatsapp_link';
    const whatsappReady =
      !!s?.isActive &&
      !legacyLink &&
      (s.provider === 'mock' || ['meta', 'twilio', 'netgsm', 'custom'].includes(s.provider));
    const smsCfg = parseSmsConfig(s?.extraConfig);
    const smsReady = smsConfigReady(smsCfg);
    return {
      whatsappReady,
      smsReady,
      apiReady: whatsappReady || smsReady,
      defaultChannel: defaultChannelForCampaign('toplu_mesaj', false, smsReady, whatsappReady),
    };
  }

  getChannelRulesForType(type: CampaignType, hasAttachment = false) {
    const hasPdf = campaignHasPdfAttachment(type, hasAttachment ? 'x' : null);
    return { hasPdf, allowed: allowedChannels(type, hasPdf) };
  }

  // ── Şablon kütüphanesi ─────────────────────────────────────────────────────

  async listTemplates(schoolId: string) {
    await this._seedTemplatesIfEmpty(schoolId);
    return this.templateRepo.find({ where: { schoolId }, order: { campaignType: 'ASC', title: 'ASC' } });
  }

  async saveTemplate(
    schoolId: string,
    dto: { id?: string; campaignType: string; title: string; body: string; variables?: string },
  ) {
    if (dto.id) {
      const row = await this.templateRepo.findOne({ where: { id: dto.id, schoolId } });
      if (!row) throw new NotFoundException();
      Object.assign(row, dto);
      return this.templateRepo.save(row);
    }
    return this.templateRepo.save(
      this.templateRepo.create({
        schoolId,
        campaignType: dto.campaignType,
        title: dto.title,
        body: dto.body,
        variables: dto.variables ?? null,
        isSystem: false,
      }),
    );
  }

  async deleteTemplate(schoolId: string, id: string) {
    const row = await this.templateRepo.findOne({ where: { id, schoolId } });
    if (!row) throw new NotFoundException();
    if (row.isSystem) throw new BadRequestException('Sistem şablonu silinemez');
    await this.templateRepo.remove(row);
    return { ok: true };
  }

  private async _seedTemplatesIfEmpty(schoolId: string) {
    const n = await this.templateRepo.count({ where: { schoolId } });
    if (n > 0) return;
    const seeds: Array<{ campaignType: string; title: string; body: string; variables: string }> = [
      { campaignType: 'toplu_mesaj', title: 'Bilgilendirme', body: TPL_VELI_ILETISIM, variables: '{AD}' },
      { campaignType: 'devamsizlik', title: 'Devamsızlık', body: TPL_DEVAMSIZLIK, variables: '{AD},{OGRENCI},{SINIF},{TARIH},{GUN},{TUR},{OKUL}' },
      { campaignType: 'ders_devamsizlik', title: 'Ders devamsızlık', body: TPL_DERS_DEVAMSIZLIK, variables: '{AD},{OGRENCI},{SINIF},{TARIH},{DERSLER_INLINE},{OKUL}' },
      { campaignType: 'veli_toplantisi', title: 'Veli toplantısı', body: TPL_VELI_TOPLANTISI, variables: '{AD}' },
      { campaignType: 'karne', title: 'Karne', body: TPL_KARNE, variables: '{AD},{OGRENCI},{SINIF},{OKUL}' },
      { campaignType: 'izin', title: 'İzin', body: TPL_IZIN, variables: '{AD},{OGRENCI},{SINIF},{TUR},{CIKIS},{DONUS},{OKUL}' },
      { campaignType: 'ek_ders', title: 'Ek ders', body: TPL_EK_DERS, variables: '{AD},{AY},{SAAT},{TUTAR}' },
      { campaignType: 'maas', title: 'Maaş', body: TPL_MAAS, variables: '{AD},{AY},{BRUT},{NET}' },
      { campaignType: 'davetiye', title: 'Davetiye', body: TPL_DAVETIYE, variables: '{AD},{MESAJ},{OKUL}' },
      { campaignType: 'toplu_mesaj', title: 'Acil bilgilendirme', body: TPL_ACIL, variables: '{AD},{MESAJ},{OKUL}' },
    ];
    await this.templateRepo.save(seeds.map((s) => this.templateRepo.create({ schoolId, ...s, isSystem: true })));
  }

  // ── Opt-out & veli tercihleri ─────────────────────────────────────────────

  private _normPhone(phone: string): string {
    let d = String(phone).replace(/\D/g, '');
    if (d.startsWith('0')) d = '90' + d.slice(1);
    if (d.length === 10 && !d.startsWith('90')) d = '90' + d;
    return d;
  }

  async listOptOuts(schoolId: string) {
    return this.optOutRepo.find({ where: { schoolId }, order: { createdAt: 'DESC' }, take: 500 });
  }

  async addOptOut(schoolId: string, phone: string, reason?: string) {
    const p = this._normPhone(phone);
    if (p.length < 10) throw new BadRequestException('Geçersiz telefon');
    const existing = await this.optOutRepo.findOne({ where: { schoolId, phone: p } });
    if (existing) return existing;
    return this.optOutRepo.save(this.optOutRepo.create({ schoolId, phone: p, reason: reason ?? null }));
  }

  async removeOptOut(schoolId: string, id: string) {
    await this.optOutRepo.delete({ id, schoolId });
    return { ok: true };
  }

  async listContactPreferences(schoolId: string) {
    return this.contactPrefRepo.find({ where: { schoolId }, order: { updatedAt: 'DESC' }, take: 500 });
  }

  async upsertContactPreference(
    schoolId: string,
    dto: {
      phone: string;
      name?: string;
      preferredChannel?: 'whatsapp' | 'sms';
      noSms?: boolean;
      noWhatsapp?: boolean;
      quietHoursNote?: string;
    },
  ) {
    const phone = this._normPhone(dto.phone);
    let row = await this.contactPrefRepo.findOne({ where: { schoolId, phone } });
    if (!row) row = this.contactPrefRepo.create({ schoolId, phone });
    if (dto.name !== undefined) row.name = dto.name;
    if (dto.preferredChannel) row.preferredChannel = dto.preferredChannel;
    if (dto.noSms !== undefined) row.noSms = dto.noSms;
    if (dto.noWhatsapp !== undefined) row.noWhatsapp = dto.noWhatsapp;
    if (dto.quietHoursNote !== undefined) row.quietHoursNote = dto.quietHoursNote;
    return this.contactPrefRepo.save(row);
  }

  private async _isOptedOut(schoolId: string, phone: string): Promise<boolean> {
    const p = this._normPhone(phone);
    return !!(await this.optOutRepo.findOne({ where: { schoolId, phone: p } }));
  }

  // ── Onay akışı ───────────────────────────────────────────────────────────

  async listPendingApprovals(schoolId: string) {
    return this.campaignRepo.find({
      where: { schoolId, approvalStatus: 'pending' },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async approveCampaign(schoolId: string, campaignId: string, approverId: string) {
    const c = await this.getCampaign(schoolId, campaignId);
    if (c.approvalStatus !== 'pending') throw new BadRequestException('Onay bekleyen kampanya değil');
    c.approvalStatus = 'approved';
    c.approvedBy = approverId;
    c.approvedAt = new Date();
    return this.campaignRepo.save(c);
  }

  async rejectCampaign(schoolId: string, campaignId: string, approverId: string, reason?: string) {
    const c = await this.getCampaign(schoolId, campaignId);
    if (c.approvalStatus !== 'pending') throw new BadRequestException('Onay bekleyen kampanya değil');
    c.approvalStatus = 'rejected';
    c.approvedBy = approverId;
    c.approvedAt = new Date();
    c.metadata = { ...(c.metadata ?? {}), rejectionReason: reason ?? '' };
    return this.campaignRepo.save(c);
  }

  // ── Zamanlama ─────────────────────────────────────────────────────────────

  async scheduleCampaign(
    schoolId: string,
    campaignId: string,
    atIso: string,
    opts: ExecuteCampaignDto,
    requester?: { userId: string; role: string },
  ) {
    const campaign = await this.getCampaign(schoolId, campaignId);
    if (requester?.role === UserRole.teacher && campaign.createdBy !== requester.userId) {
      throw new ForbiddenException();
    }
    if (campaign.approvalStatus === 'pending') {
      throw new BadRequestException('Önce yönetici onayı gerekli');
    }
    const at = new Date(atIso);
    if (Number.isNaN(at.getTime()) || at.getTime() <= Date.now() + 60_000) {
      throw new BadRequestException('Zamanlama en az 1 dakika sonrası olmalı');
    }
    const settings = await this.settingsRepo.findOne({ where: { schoolId } });
    const channel = opts.channel === 'sms' ? 'sms' : 'whatsapp';
    campaign.metadata = {
      ...(campaign.metadata ?? {}),
      channel,
      ...(opts.smsHeader?.trim() ? { smsHeader: opts.smsHeader.trim().slice(0, 11) } : {}),
      scheduledBy: requester?.userId,
    };
    this._assertChannelReady(settings, channel, campaign);
    campaign.scheduledAt = at;
    return this.campaignRepo.save(campaign);
  }

  async cancelSchedule(schoolId: string, campaignId: string) {
    const c = await this.getCampaign(schoolId, campaignId);
    c.scheduledAt = null;
    return this.campaignRepo.save(c);
  }

  async executeScheduledCampaign(schoolId: string, campaignId: string, channel: 'whatsapp' | 'sms') {
    const c = await this.getCampaign(schoolId, campaignId);
    c.scheduledAt = null;
    await this.campaignRepo.save(c);
    return this.executeCampaign(schoolId, campaignId, undefined, { channel });
  }

  // ── Export & iletişim geçmişi ─────────────────────────────────────────────

  async exportReportsCsv(schoolId: string, fromIso?: string, toIso?: string): string {
    const data = await this.getReportsOverview(schoolId, fromIso, toIso);
    const lines = [
      'Tür,Kampanya,Gönderilen,Hatalı,Toplam,Başarı%',
      ...data.byType.map((t) =>
        `${t.type},${t.campaigns},${t.sent},${t.failed},${t.total},${t.successRate ?? ''}`,
      ),
      '',
      'Kampanya,Başlık,Durum,Gönderilen,Hatalı,Toplam,Oran%,Kanal,Tarih',
      ...data.recentCampaigns.map((c) =>
        `${c.type},"${c.title.replace(/"/g, '""')}",${c.status},${c.sentCount},${c.failedCount},${c.totalCount},${c.deliveryRate ?? ''},${c.channel ?? ''},${c.createdAt}`,
      ),
    ];
    return '\uFEFF' + lines.join('\n');
  }

  async exportCampaignCsv(schoolId: string, campaignId: string): string {
    await this.getCampaign(schoolId, campaignId);
    const rows = await this.recipientRepo.find({ where: { campaignId }, order: { sortOrder: 'ASC' } });
    const lines = [
      'Ad,Telefon,Öğrenci,Sınıf,Durum,Hata,Mesaj',
      ...rows.map((r) =>
        [
          r.recipientName ?? '',
          r.phone ?? '',
          r.studentName ?? '',
          r.className ?? '',
          r.status,
          (r.errorMsg ?? '').replace(/"/g, '""'),
          (r.messageText ?? '').replace(/"/g, '""').replace(/\n/g, ' '),
        ]
          .map((v) => `"${v}"`)
          .join(','),
      ),
    ];
    return '\uFEFF' + lines.join('\n');
  }

  async getContactHistory(schoolId: string, phone: string) {
    const diary = await this.getCommunicationDiary(schoolId, phone);
    return diary.outbound;
  }

  async getCommunicationDiary(schoolId: string, phone: string) {
    const normalized = this._normPhone(phone);
    const suffix = normalized.slice(-10);
    const like = `%${suffix}`;

    const outbound: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT r.id, r.campaign_id, r.recipient_name, r.phone, r.status, r.sent_at, r.error_msg,
              r.message_text, r.provider_message_id, r.delivery_status, r.delivered_at, r.read_at,
              c.title, c.type, c.status AS campaign_status, c.created_at,
              COALESCE(c.metadata->>'channel', 'whatsapp') AS channel
       FROM messaging_recipients r
       INNER JOIN messaging_campaigns c ON c.id = r.campaign_id
       WHERE c.school_id = $1
         AND regexp_replace(COALESCE(r.phone, ''), '\\D', '', 'g') LIKE $2
       ORDER BY COALESCE(r.sent_at, r.created_at) DESC
       LIMIT 50`,
      [schoolId, like],
    );

    const inbound = await this.inboundRepo
      .createQueryBuilder('m')
      .where('m.school_id = :schoolId', { schoolId })
      .andWhere("regexp_replace(m.phone, '\\\\D', '', 'g') LIKE :like", { like })
      .orderBy('m.received_at', 'DESC')
      .take(50)
      .getMany();

    const deliveryEvents = await this.deliveryRepo
      .createQueryBuilder('e')
      .where('e.school_id = :schoolId', { schoolId })
      .andWhere(
        `(e.recipient_id IN (
          SELECT r.id FROM messaging_recipients r
          INNER JOIN messaging_campaigns c ON c.id = r.campaign_id
          WHERE c.school_id = :schoolId
            AND regexp_replace(COALESCE(r.phone, ''), '\\\\D', '', 'g') LIKE :like
        ) OR e.external_message_id IN (
          SELECT r.provider_message_id FROM messaging_recipients r
          INNER JOIN messaging_campaigns c ON c.id = r.campaign_id
          WHERE c.school_id = :schoolId
            AND r.provider_message_id IS NOT NULL
            AND regexp_replace(COALESCE(r.phone, ''), '\\\\D', '', 'g') LIKE :like
        ))`,
        { schoolId, like },
      )
      .orderBy('e.created_at', 'DESC')
      .take(80)
      .getMany();

    type TimelineItem = {
      kind: 'outbound' | 'inbound' | 'delivery';
      at: string;
      payload: Record<string, unknown>;
    };

    const timeline: TimelineItem[] = [];
    for (const o of outbound) {
      timeline.push({
        kind: 'outbound',
        at: (o.sent_at as Date)?.toISOString?.() ?? (o.created_at as Date)?.toISOString?.() ?? new Date().toISOString(),
        payload: o,
      });
    }
    for (const m of inbound) {
      timeline.push({ kind: 'inbound', at: m.receivedAt.toISOString(), payload: m as unknown as Record<string, unknown> });
    }
    for (const e of deliveryEvents) {
      timeline.push({ kind: 'delivery', at: e.createdAt.toISOString(), payload: e as unknown as Record<string, unknown> });
    }
    timeline.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    return { phone: normalized, outbound, inbound, deliveryEvents, timeline };
  }

  async listRecentCommunicationPhones(schoolId: string, limit = 30) {
    const rows: Array<{ phone: string; last_at: Date }> = await this.dataSource.query(
      `SELECT phone, MAX(last_at) AS last_at FROM (
         SELECT regexp_replace(phone, '\\D', '', 'g') AS phone, received_at AS last_at
         FROM messaging_inbound_messages WHERE school_id = $1
         UNION ALL
         SELECT regexp_replace(COALESCE(r.phone, ''), '\\D', '', 'g'),
                COALESCE(r.sent_at, r.created_at)
         FROM messaging_recipients r
         INNER JOIN messaging_campaigns c ON c.id = r.campaign_id
         WHERE c.school_id = $1 AND r.phone IS NOT NULL
       ) t
       WHERE phone <> ''
       GROUP BY phone
       ORDER BY MAX(last_at) DESC
       LIMIT $2`,
      [schoolId, limit],
    );
    return rows.map((r) => ({ phone: r.phone, lastAt: r.last_at }));
  }

  async saveSettings(schoolId: string, dto: SaveSettingsDto) {
    let s = await this.settingsRepo.findOne({ where: { schoolId } });
    if (!s) s = this.settingsRepo.create({ schoolId });

    const { extraConfig: dtoExtra, ...rest } = dto;
    const mergedExtra: Record<string, unknown> = { ...(s.extraConfig ?? {}), ...(dtoExtra ?? {}) };

    const apiProviders: Array<SaveSettingsDto['provider']> = ['meta', 'twilio', 'netgsm', 'custom'];
    if (rest.isActive && apiProviders.includes(rest.provider)) {
      if (mergedExtra.policyComplianceAck !== true) {
        throw new BadRequestException({
          code: 'POLICY_ACK_REQUIRED',
          message:
            'WhatsApp Business Platform kullanımı için okul olarak politika onayı gerekli. Sayfadaki “Uyumluluk” bölümünü işaretleyin.',
        });
      }
      mergedExtra.policyComplianceAckAt = mergedExtra.policyComplianceAckAt ?? new Date().toISOString();
      mergedExtra.complianceAckVersion = '2025-04';
    }
    if ((rest.provider as string) === 'whatsapp_link') {
      throw new BadRequestException({
        code: 'WHATSAPP_LINK_REMOVED',
        message: 'WhatsApp Web (wa.me) modu kaldırıldı. Meta, Twilio, Netgsm veya özel API seçin.',
      });
    }

    const prevSms = parseSmsConfig(s.extraConfig);
    const smsIncoming = (dtoExtra?.sms ?? null) as Partial<SmsConfig> | null;
    if (smsIncoming && typeof smsIncoming === 'object') {
      if (smsIncoming.isActive && smsIncoming.commercialAck !== true) {
        throw new BadRequestException({
          code: 'SMS_ACK_REQUIRED',
          message: 'SMS ticari gönderim için İYS / mevzuat onayı gerekli.',
        });
      }
      s.extraConfig = mergeSmsIntoExtra(mergedExtra, smsIncoming, prevSms);
    } else {
      s.extraConfig = mergedExtra;
    }

    if (!rest.apiKey?.trim() && s.apiKey) rest.apiKey = s.apiKey;
    if (!rest.apiSecret?.trim() && s.apiSecret) rest.apiSecret = s.apiSecret;

    Object.assign(s, rest);
    return this.settingsRepo.save(s);
  }

  async testConnection(schoolId: string, testPhone: string): Promise<{ ok: boolean; message: string }> {
    const s = await this.settingsRepo.findOne({ where: { schoolId } });
    if (!s) return { ok: false, message: 'Ayarlar bulunamadı' };
    if ((s.provider as string) === 'whatsapp_link') {
      return {
        ok: false,
        message: 'WhatsApp Web modu kaldırıldı. Ayarlardan resmi API sağlayıcısı seçin.',
      };
    }
    const res = await this.wa.sendText(s, testPhone, '🔔 Uzaedu Öğretmen — WhatsApp bağlantı testi başarılı!');
    return { ok: res.success, message: res.error ?? 'Gönderildi' };
  }

  async testSmsConnection(
    schoolId: string,
    testPhone: string,
    testMessage?: string,
  ): Promise<{ ok: boolean; message: string }> {
    const s = await this.settingsRepo.findOne({ where: { schoolId } });
    if (!s) return { ok: false, message: 'Ayarlar bulunamadı' };
    const sms = parseSmsConfig(s.extraConfig);
    if (!smsConfigReady(sms)) {
      return { ok: false, message: 'SMS entegrasyonu aktif değil veya başlık / API bilgisi eksik' };
    }
    const msg = (testMessage ?? '').trim() || '🔔 Uzaedu — SMS bağlantı testi başarılı!';
    const res = await this.sms.sendText(sms, testPhone, msg);
    return { ok: res.success, message: res.error ?? (res.messageId ? `Gönderildi (${res.messageId})` : 'Gönderildi') };
  }

  // ── Kampanyalar ────────────────────────────────────────────────────────────

  async listCampaigns(schoolId: string, limit = 30) {
    return this.campaignRepo.find({ where: { schoolId }, order: { createdAt: 'DESC' }, take: limit });
  }

  /** Okul geneli iletim raporu (tarih aralığı, kanal/tür kırılımı). */
  async getReportsOverview(schoolId: string, fromIso?: string, toIso?: string) {
    const to = toIso ? new Date(`${toIso}T23:59:59.999`) : new Date();
    const from = fromIso
      ? new Date(`${fromIso}T00:00:00.000`)
      : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

    const campaigns = await this.campaignRepo.find({
      where: { schoolId, createdAt: Between(from, to) },
      order: { createdAt: 'DESC' },
      take: 80,
    });

    const recipientStatusRows = await this.recipientRepo
      .createQueryBuilder('r')
      .innerJoin(MessagingCampaign, 'c', 'c.id = r.campaignId')
      .select('r.status', 'status')
      .addSelect('COUNT(*)', 'cnt')
      .where('c.schoolId = :schoolId', { schoolId })
      .andWhere('c.createdAt BETWEEN :from AND :to', { from, to })
      .groupBy('r.status')
      .getRawMany<{ status: string; cnt: string }>();

    const byTypeRows = await this.recipientRepo
      .createQueryBuilder('r')
      .innerJoin(MessagingCampaign, 'c', 'c.id = r.campaignId')
      .select('c.type', 'type')
      .addSelect('r.status', 'status')
      .addSelect('COUNT(*)', 'cnt')
      .where('c.schoolId = :schoolId', { schoolId })
      .andWhere('c.createdAt BETWEEN :from AND :to', { from, to })
      .groupBy('c.type')
      .addGroupBy('r.status')
      .getRawMany<{ type: string; status: string; cnt: string }>();

    const channelRows = await this.recipientRepo
      .createQueryBuilder('r')
      .innerJoin(MessagingCampaign, 'c', 'c.id = r.campaignId')
      .select("COALESCE(NULLIF(TRIM(c.metadata->>'channel'), ''), 'belirtilmedi')", 'channel')
      .addSelect('r.status', 'status')
      .addSelect('COUNT(*)', 'cnt')
      .where('c.schoolId = :schoolId', { schoolId })
      .andWhere('c.createdAt BETWEEN :from AND :to', { from, to })
      .andWhere("r.status IN ('sent', 'failed')")
      .groupBy("COALESCE(NULLIF(TRIM(c.metadata->>'channel'), ''), 'belirtilmedi')")
      .addGroupBy('r.status')
      .getRawMany<{ channel: string; status: string; cnt: string }>();

    const timelineRows = await this.recipientRepo
      .createQueryBuilder('r')
      .innerJoin(MessagingCampaign, 'c', 'c.id = r.campaignId')
      .select('DATE(r.sentAt)', 'day')
      .addSelect("SUM(CASE WHEN r.status = 'sent' THEN 1 ELSE 0 END)", 'sent')
      .addSelect("SUM(CASE WHEN r.status = 'failed' THEN 1 ELSE 0 END)", 'failed')
      .where('c.schoolId = :schoolId', { schoolId })
      .andWhere('r.sentAt IS NOT NULL')
      .andWhere('r.sentAt BETWEEN :from AND :to', { from, to })
      .groupBy('day')
      .orderBy('day', 'ASC')
      .getRawMany<{ day: string; sent: string; failed: string }>();

    const topErrors = await this.recipientRepo
      .createQueryBuilder('r')
      .innerJoin(MessagingCampaign, 'c', 'c.id = r.campaignId')
      .select('r.errorMsg', 'error')
      .addSelect('COUNT(*)', 'cnt')
      .where('c.schoolId = :schoolId', { schoolId })
      .andWhere('c.createdAt BETWEEN :from AND :to', { from, to })
      .andWhere("r.status = 'failed'")
      .andWhere('r.errorMsg IS NOT NULL')
      .andWhere("TRIM(r.errorMsg) <> ''")
      .groupBy('r.errorMsg')
      .orderBy('cnt', 'DESC')
      .limit(8)
      .getRawMany<{ error: string; cnt: string }>();

    const num = (rows: { cnt: string }[]) =>
      rows.reduce((s, x) => s + Number(x.cnt || 0), 0);

    const recipients = {
      total: num(recipientStatusRows),
      sent: Number(recipientStatusRows.find((x) => x.status === 'sent')?.cnt ?? 0),
      failed: Number(recipientStatusRows.find((x) => x.status === 'failed')?.cnt ?? 0),
      pending: Number(recipientStatusRows.find((x) => x.status === 'pending')?.cnt ?? 0),
      skipped: Number(recipientStatusRows.find((x) => x.status === 'skipped')?.cnt ?? 0),
    };

    const attempted = recipients.sent + recipients.failed;
    const deliveryRate = attempted > 0 ? Math.round((recipients.sent / attempted) * 1000) / 10 : null;

    const byCampaignStatus: Record<string, number> = {};
    for (const c of campaigns) {
      byCampaignStatus[c.status] = (byCampaignStatus[c.status] ?? 0) + 1;
    }

    const typeMap = new Map<string, { campaigns: Set<string>; sent: number; failed: number; pending: number; total: number }>();
    for (const c of campaigns) {
      if (!typeMap.has(c.type)) {
        typeMap.set(c.type, { campaigns: new Set(), sent: 0, failed: 0, pending: 0, total: 0 });
      }
      typeMap.get(c.type)!.campaigns.add(c.id);
    }
    for (const row of byTypeRows) {
      const t = typeMap.get(row.type) ?? {
        campaigns: new Set<string>(),
        sent: 0,
        failed: 0,
        pending: 0,
        total: 0,
      };
      const n = Number(row.cnt || 0);
      t.total += n;
      if (row.status === 'sent') t.sent += n;
      else if (row.status === 'failed') t.failed += n;
      else if (row.status === 'pending') t.pending += n;
      typeMap.set(row.type, t);
    }

    const byType = [...typeMap.entries()]
      .map(([type, v]) => ({
        type,
        campaigns: v.campaigns.size,
        sent: v.sent,
        failed: v.failed,
        pending: v.pending,
        total: v.total,
        successRate: v.sent + v.failed > 0 ? Math.round((v.sent / (v.sent + v.failed)) * 1000) / 10 : null,
      }))
      .sort((a, b) => b.total - a.total);

    const channelMap = new Map<string, { sent: number; failed: number }>();
    for (const row of channelRows) {
      const ch = row.channel || 'belirtilmedi';
      if (!channelMap.has(ch)) channelMap.set(ch, { sent: 0, failed: 0 });
      const n = Number(row.cnt || 0);
      if (row.status === 'sent') channelMap.get(ch)!.sent += n;
      else if (row.status === 'failed') channelMap.get(ch)!.failed += n;
    }
    const byChannel = [...channelMap.entries()]
      .map(([channel, v]) => ({
        channel,
        sent: v.sent,
        failed: v.failed,
        total: v.sent + v.failed,
        successRate: v.sent + v.failed > 0 ? Math.round((v.sent / (v.sent + v.failed)) * 1000) / 10 : null,
      }))
      .sort((a, b) => b.total - a.total);

    const recentCampaigns = campaigns.slice(0, 25).map((c) => {
      const ch = (c.metadata as Record<string, unknown> | undefined)?.channel;
      const attemptedC = c.sentCount + c.failedCount;
      return {
        id: c.id,
        title: c.title,
        type: c.type,
        status: c.status,
        totalCount: c.totalCount,
        sentCount: c.sentCount,
        failedCount: c.failedCount,
        pendingCount: Math.max(0, c.totalCount - c.sentCount - c.failedCount),
        channel: typeof ch === 'string' ? ch : null,
        createdAt: c.createdAt,
        deliveryRate: attemptedC > 0 ? Math.round((c.sentCount / attemptedC) * 1000) / 10 : null,
      };
    });

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      summary: {
        campaignsTotal: campaigns.length,
        campaignsCompleted: byCampaignStatus.completed ?? 0,
        campaignsSending: byCampaignStatus.sending ?? 0,
        campaignsPreview: byCampaignStatus.preview ?? 0,
        campaignsFailed: byCampaignStatus.failed ?? 0,
        campaignsCancelled: byCampaignStatus.cancelled ?? 0,
        ...recipients,
        deliveryRate,
      },
      byCampaignStatus: Object.entries(byCampaignStatus).map(([status, count]) => ({ status, count })),
      byType,
      byChannel,
      timeline: timelineRows.map((r) => ({
        day: String(r.day).slice(0, 10),
        sent: Number(r.sent || 0),
        failed: Number(r.failed || 0),
      })),
      topErrors: topErrors.map((e) => ({ message: e.error, count: Number(e.cnt || 0) })),
      recentCampaigns,
    };
  }

  async getCampaign(schoolId: string, id: string) {
    const c = await this.campaignRepo.findOne({ where: { id, schoolId } });
    if (!c) throw new NotFoundException();
    return c;
  }

  async deleteCampaign(schoolId: string, id: string) {
    const c = await this.campaignRepo.findOne({ where: { id, schoolId } });
    if (!c) throw new NotFoundException();
    await this.recipientRepo.delete({ campaignId: id });
    await this.campaignRepo.remove(c);
  }

  async listRecipients(schoolId: string, campaignId: string, limit = 500) {
    const c = await this.getCampaign(schoolId, campaignId);
    return this.recipientRepo.find({ where: { campaignId: c.id }, order: { sortOrder: 'ASC' }, take: limit });
  }

  // ── Toplu Mesaj (serbest Excel) ─────────────────────────────────────────────

  async createTopluMesajCampaign(schoolId: string, userId: string, title: string, message: string, fileBuffer: Buffer, filename: string) {
    const parsed = parseTopluMesaj(fileBuffer, message);
    if (!parsed.length) throw new BadRequestException('Excel dosyasından alıcı bulunamadı');
    return this._saveCampaign(schoolId, userId, 'toplu_mesaj', title, parsed, fileBuffer, filename, { customMessage: message });
  }

  async createManualCampaign(schoolId: string, userId: string, title: string, recipients: Array<{ name: string; phone: string; message: string }>) {
    const parsed: ParsedRecipient[] = recipients.map((r, i) => ({ recipientName: r.name, phone: r.phone, messageText: r.message, sortOrder: i }));
    if (!parsed.length) throw new BadRequestException('En az bir alıcı gerekli');
    return this._saveCampaign(schoolId, userId, 'toplu_mesaj', title, parsed, null, null, {});
  }

  async createAcilCampaign(
    schoolId: string,
    userId: string,
    title: string,
    message: string,
    recipients: Array<{ name?: string; phone: string }>,
  ) {
    const okul = await this._getSchoolName(schoolId);
    const parsed: ParsedRecipient[] = recipients.map((r, i) => ({
      recipientName: r.name ?? 'Veli',
      phone: r.phone,
      messageText: TPL_ACIL.replace('{AD}', r.name ?? 'Veli').replace('{MESAJ}', message).replace('{OKUL}', okul),
      sortOrder: i,
    }));
    if (!parsed.length) throw new BadRequestException('En az bir telefon gerekli');
    return this._saveCampaign(schoolId, userId, 'toplu_mesaj', title || '🚨 Acil bilgilendirme', parsed, null, null, {
      acil: true,
      channel: 'whatsapp',
    });
  }

  // ── Ek Ders ───────────────────────────────────────────────────────────────

  async createEkDersCampaign(schoolId: string, userId: string, title: string, template: string, fileBuffer: Buffer, filename: string) {
    const parsed = parseEkDers(fileBuffer, template);
    if (!parsed.length) throw new BadRequestException('Excel dosyasından kayıt bulunamadı');
    return this._saveCampaign(schoolId, userId, 'ek_ders', title, parsed, fileBuffer, filename, { template });
  }

  // ── Maaş ──────────────────────────────────────────────────────────────────

  async createMaasCampaign(schoolId: string, userId: string, title: string, template: string, fileBuffer: Buffer, filename: string) {
    const parsed = parseMaas(fileBuffer, template);
    if (!parsed.length) throw new BadRequestException('Excel dosyasından kayıt bulunamadı');
    return this._saveCampaign(schoolId, userId, 'maas', title, parsed, fileBuffer, filename, { template });
  }

  // ── Günlük Devamsızlık ────────────────────────────────────────────────────

  async createDevamsizlikCampaign(schoolId: string, userId: string, title: string, template: string, tarih: string, fileBuffer: Buffer, filename: string) {
    const tpl = await this._fillSchoolName(schoolId, template);
    const parsed = parseDevamsizlik(fileBuffer, tpl, tarih);
    if (!parsed.length) throw new BadRequestException('Excel dosyasından kayıt bulunamadı');
    return this._saveCampaign(schoolId, userId, 'devamsizlik', title, parsed, fileBuffer, filename, { template: tpl, tarih });
  }

  // ── Devamsızlık Mektubu / Karne (PDF split) ─────────────────────────────

  async createPdfSplitCampaign(
    schoolId: string, userId: string, type: 'devamsizlik_mektup' | 'karne' | 'ara_karne',
    title: string, template: string,
    pdfBuffer: Buffer, pdfFilename: string,
    recipientList: Array<{ name: string; phone: string; studentName?: string; studentNumber?: string; className?: string }>,
    pagesPerStudent: number,
  ) {
    const tplWithSchool = await this._fillSchoolName(schoolId, template);
    const splits = await splitPdfByPageCount(pdfBuffer, pagesPerStudent);

    if (splits.length !== recipientList.length) {
      throw new BadRequestException(
        `PDF sayfa grubu (${splits.length}) ile alıcı sayısı (${recipientList.length}) uyuşmuyor. pagesPerStudent=${pagesPerStudent} veya alıcı listesini kontrol edin.`,
      );
    }

    const campaignDir = join(UPLOADS_DIR, `${Date.now()}_${type}`);
    mkdirSync(campaignDir, { recursive: true });

    // Orijinal PDF kaydet
    const origPath = join(campaignDir, 'original_' + pdfFilename);
    writeFileSync(origPath, pdfBuffer);

    const parsed: ParsedRecipient[] = [];
    for (let i = 0; i < recipientList.length; i++) {
      const rec = recipientList[i];
      const split = splits[i];
      const splitPath = join(campaignDir, `split_${i}_${(rec.studentName ?? rec.name).replace(/\s+/g, '_')}.pdf`);
      writeFileSync(splitPath, split.buffer);
      const msg = tplWithSchool.replace('{AD}', rec.name).replace('{OGRENCI}', rec.studentName ?? '').replace('{SINIF}', rec.className ?? '');
      parsed.push({ recipientName: rec.name, phone: rec.phone, studentName: rec.studentName, studentNumber: rec.studentNumber, className: rec.className, messageText: msg, sortOrder: i });
    }

    const campaign = await this._saveCampaign(schoolId, userId, type, title, parsed, null, pdfFilename, { template, pagesPerStudent, campaignDir });

    // Dosya yollarını alıcılara ekle
    const recipients = await this.recipientRepo.find({ where: { campaignId: campaign.id }, order: { sortOrder: 'ASC' } });
    for (let i = 0; i < recipients.length; i++) {
      const splitPath = join(campaignDir, `split_${i}_${(recipientList[i].studentName ?? recipientList[i].name).replace(/\s+/g, '_')}.pdf`);
      recipients[i].filePath = splitPath;
    }
    await this.recipientRepo.save(recipients);

    return campaign;
  }

  // ── Ders Bazlı Devamsızlık ────────────────────────────────────────────────

  async createDersDevamsizlikCampaign(schoolId: string, userId: string, title: string, template: string, tarih: string, fileBuffer: Buffer, filename: string) {
    const tpl = await this._fillSchoolName(schoolId, template);
    const parsed = parseDersDevamsizlik(fileBuffer, tpl, tarih);
    if (!parsed.length) throw new BadRequestException('Excel dosyasından kayıt bulunamadı');
    return this._saveCampaign(schoolId, userId, 'ders_devamsizlik', title, parsed, fileBuffer, filename, { template: tpl, tarih });
  }

  // ── Evci / Çarşı İzin ─────────────────────────────────────────────────────

  async createIzinCampaign(schoolId: string, userId: string, title: string, template: string, tarih: string, fileBuffer: Buffer, filename: string) {
    const tpl = await this._fillSchoolName(schoolId, template);
    const parsed = parseIzin(fileBuffer, tpl, tarih);
    if (!parsed.length) throw new BadRequestException('Excel dosyasından kayıt bulunamadı');
    return this._saveCampaign(schoolId, userId, 'izin', title, parsed, fileBuffer, filename, { template: tpl, tarih });
  }

  // ── Veli Toplantısı / Davetiye ─────────────────────────────────────────────

  async createSimpleCampaign(
    schoolId: string, userId: string,
    type: 'veli_toplantisi' | 'davetiye' | 'toplu_mesaj' | 'grup_mesaj',
    title: string, message: string,
    recipientSource: 'excel' | 'group' | 'manual',
    excelBuffer?: Buffer, excelFilename?: string,
    groupId?: string,
    manualRows?: Array<{ name: string; phone: string }>,
    attachmentBuffer?: Buffer, attachmentFilename?: string,
  ) {
    let parsed: ParsedRecipient[] = [];

    if (recipientSource === 'excel' && excelBuffer) {
      parsed = parseTopluMesaj(excelBuffer, message);
    } else if (recipientSource === 'group' && groupId) {
      const members = await this.memberRepo.find({ where: { groupId }, order: { name: 'ASC' } });
      parsed = members.map((m, i) => ({ recipientName: m.name ?? '', phone: m.phone, messageText: message.replace('{AD}', m.name ?? ''), sortOrder: i }));
    } else if (recipientSource === 'manual' && manualRows?.length) {
      parsed = manualRows.map((r, i) => ({ recipientName: r.name, phone: r.phone, messageText: message.replace('{AD}', r.name), sortOrder: i }));
    }

    if (!parsed.length) throw new BadRequestException('Alıcı listesi boş');

    const campaign = await this._saveCampaign(schoolId, userId, type, title, parsed, excelBuffer ?? null, excelFilename ?? null, { message, groupId });

    // Tek ortak dosya eki
    if (attachmentBuffer && attachmentFilename) {
      const dir = join(UPLOADS_DIR, campaign.id);
      mkdirSync(dir, { recursive: true });
      const attPath = join(dir, attachmentFilename);
      writeFileSync(attPath, attachmentBuffer);
      campaign.attachmentPath = attPath;
      campaign.attachmentName = attachmentFilename;
      await this.campaignRepo.save(campaign);
    }

    return campaign;
  }

  // ── MEBBİS/KBS Bordro Kampanyaları ────────────────────────────────────────

  /**
   * Bordro tiplerinde:
   * 1. Excel parse edilir; öğretmen bazında satırlar gruplandırılır
   * 2. Okul'daki öğretmen telefon numaraları TC veya isim ile eşleştirilir
   * 3. Eşleşmeyen öğretmenler "unmatchedTeachers" listesinde döner
   * 4. İstemci bu listeyi gösterir; eksik telefonlar manuel girilebilir
   */
  private async _getSchoolName(schoolId: string): Promise<string> {
    const rows: Array<{ name: string }> = await this.dataSource.query(
      `SELECT name FROM schools WHERE id = $1 LIMIT 1`, [schoolId],
    );
    return rows[0]?.name ?? '';
  }

  private async _fillSchoolName(schoolId: string, template: string): Promise<string> {
    if (!template.includes('{OKUL}')) return template;
    const name = await this._getSchoolName(schoolId);
    return template.replace(/\{OKUL\}/g, name);
  }

  async parseBordro(
    schoolId: string,
    type: 'mebbis_puantaj' | 'ek_ders_bordro' | 'maas_bordro',
    buf: Buffer,
    donemLabel: string,
    schoolName?: string,
    footerNote?: string,
  ): Promise<{ matched: BordroTeacher[]; unmatched: BordroTeacher[] }> {
    const sName = schoolName ?? await this._getSchoolName(schoolId);
    let teachers: BordroTeacher[];
    if (type === 'mebbis_puantaj')   teachers = parseMebbisPuantaj(buf, donemLabel, sName, footerNote);
    else if (type === 'ek_ders_bordro') teachers = parseEkDersBordro(buf, donemLabel, sName, footerNote);
    else                              teachers = parseMaasBordro(buf, donemLabel, sName, footerNote);

    if (!teachers.length) throw new BadRequestException('Excel dosyasından öğretmen verisi çıkarılamadı');

    // Okul öğretmenlerini getir (phone, name, tc)
    const dbTeachers: Array<{ name: string; phone: string; tc: string }> = await this.dataSource.query(
      `SELECT CONCAT(u.first_name, ' ', u.last_name) AS name, u.phone, u.tc_no AS tc
       FROM users u
       JOIN school_teachers st ON st.user_id = u.id
       WHERE st.school_id = $1 AND u.role = 'teacher'`,
      [schoolId],
    );

    const byTc   = new Map(dbTeachers.map((t) => [t.tc?.trim(), t.phone]));
    const byName = new Map(dbTeachers.map((t) => [t.name?.toUpperCase().trim(), t.phone]));

    const matched: BordroTeacher[] = [];
    const unmatched: BordroTeacher[] = [];

    for (const t of teachers) {
      // Excel'de zaten telefon varsa kullan
      if (t.phone) { matched.push(t); continue; }
      // TC ile eşleştir
      const phoneByTc = t.tc ? byTc.get(t.tc.trim()) : undefined;
      if (phoneByTc) { t.phone = phoneByTc; matched.push(t); continue; }
      // İsim ile eşleştir
      const phoneByName = byName.get(t.name.toUpperCase().trim());
      if (phoneByName) { t.phone = phoneByName; matched.push(t); continue; }
      unmatched.push(t);
    }

    return { matched, unmatched };
  }

  async createBordroCampaign(
    schoolId: string, userId: string,
    type: 'mebbis_puantaj' | 'ek_ders_bordro' | 'maas_bordro',
    title: string, donemLabel: string,
    buf: Buffer, filename: string,
    manualPhones: Record<string, string> = {},
    schoolName?: string,
    footerNote?: string,
  ) {
    const sName = schoolName ?? await this._getSchoolName(schoolId);
    let teachers: BordroTeacher[];
    if (type === 'mebbis_puantaj')   teachers = parseMebbisPuantaj(buf, donemLabel, sName, footerNote);
    else if (type === 'ek_ders_bordro') teachers = parseEkDersBordro(buf, donemLabel, sName, footerNote);
    else                              teachers = parseMaasBordro(buf, donemLabel, sName, footerNote);

    if (!teachers.length) throw new BadRequestException('Excel dosyasından öğretmen verisi çıkarılamadı');

    // DB eşleştirmesi
    const dbTeachers: Array<{ name: string; phone: string; tc: string }> = await this.dataSource.query(
      `SELECT CONCAT(u.first_name, ' ', u.last_name) AS name, u.phone, u.tc_no AS tc
       FROM users u
       JOIN school_teachers st ON st.user_id = u.id
       WHERE st.school_id = $1 AND u.role = 'teacher'`,
      [schoolId],
    );
    const byTc   = new Map(dbTeachers.map((t) => [t.tc?.trim(), t.phone]));
    const byName = new Map(dbTeachers.map((t) => [t.name?.toUpperCase().trim(), t.phone]));

    const parsed: ParsedRecipient[] = [];
    let i = 0;
    for (const t of teachers) {
      let phone = t.phone;
      if (!phone) phone = t.tc ? byTc.get(t.tc.trim()) ?? '' : '';
      if (!phone) phone = byName.get(t.name.toUpperCase().trim()) ?? '';
      if (!phone && manualPhones[t.name]) phone = this._normalizePhone(manualPhones[t.name]);
      parsed.push({ recipientName: t.name, phone: phone || '', messageText: t.messageText, sortOrder: i++ });
    }

    const campaignType: CampaignType = type === 'mebbis_puantaj' ? 'mebbis_puantaj' : type === 'ek_ders_bordro' ? 'ek_ders_bordro' : 'maas_bordro';
    return this._saveCampaign(schoolId, userId, campaignType, title, parsed, buf, filename, { donemLabel });
  }

  // ── Kişi Grupları ─────────────────────────────────────────────────────────

  async listGroups(schoolId: string) {
    return this.groupRepo.find({ where: { schoolId }, order: { name: 'ASC' } });
  }

  async createGroup(schoolId: string, name: string, description?: string) {
    const g = this.groupRepo.create({ schoolId, name, description });
    return this.groupRepo.save(g);
  }

  async updateGroup(schoolId: string, id: string, dto: { name?: string; description?: string }) {
    const g = await this.groupRepo.findOne({ where: { id, schoolId } });
    if (!g) throw new NotFoundException();
    Object.assign(g, dto);
    return this.groupRepo.save(g);
  }

  async deleteGroup(schoolId: string, id: string) {
    const g = await this.groupRepo.findOne({ where: { id, schoolId } });
    if (!g) throw new NotFoundException();
    await this.memberRepo.delete({ groupId: id });
    await this.groupRepo.remove(g);
  }

  async listGroupMembers(schoolId: string, groupId: string) {
    const g = await this.groupRepo.findOne({ where: { id: groupId, schoolId } });
    if (!g) throw new NotFoundException();
    return this.memberRepo.find({ where: { groupId }, order: { name: 'ASC' } });
  }

  async addMember(schoolId: string, groupId: string, name: string | null, phone: string, extraData?: Record<string, unknown>) {
    const g = await this.groupRepo.findOne({ where: { id: groupId, schoolId } });
    if (!g) throw new NotFoundException();
    const p = this._normalizePhone(phone);
    if (!p) throw new BadRequestException('Geçersiz telefon numarası');
    const existing = await this.memberRepo.findOne({ where: { groupId, phone: p } });
    if (existing) return existing;
    const m = await this.memberRepo.save(this.memberRepo.create({ groupId, name, phone: p, extraData: extraData ?? {} }));
    await this.groupRepo.update(groupId, { memberCount: () => 'member_count + 1' });
    return m;
  }

  async removeMember(schoolId: string, groupId: string, memberId: string) {
    const g = await this.groupRepo.findOne({ where: { id: groupId, schoolId } });
    if (!g) throw new NotFoundException();
    await this.memberRepo.delete({ id: memberId, groupId });
    const cnt = await this.memberRepo.count({ where: { groupId } });
    await this.groupRepo.update(groupId, { memberCount: cnt });
  }

  async importMembersFromExcel(schoolId: string, groupId: string, buffer: Buffer): Promise<{ imported: number; skipped: number }> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const XLSX = require('xlsx') as typeof import('xlsx');
    const wb   = XLSX.read(buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows  = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
    const headers = Object.keys(rows[0] ?? {});
    const nameCol  = headers.find((h) => /ad.*soyad|isim|name/i.test(h)) ?? headers[0];
    const phoneCol = headers.find((h) => /telefon|gsm|whatsapp|cep|phone/i.test(h)) ?? headers[1];

    let imported = 0; let skipped = 0;
    for (const row of rows) {
      const name  = String(row[nameCol] ?? '').trim();
      const phone = this._normalizePhone(row[phoneCol]);
      if (!phone) { skipped++; continue; }
      try { await this.addMember(schoolId, groupId, name || null, phone); imported++; }
      catch { skipped++; }
    }
    return { imported, skipped };
  }

  private _normalizePhone(raw: unknown): string {
    if (!raw) return '';
    let p = String(raw).replace(/\D/g, '');
    if (p.startsWith('0')) p = '90' + p.slice(1);
    if (p.length === 10) p = '90' + p;
    if (!p.startsWith('+')) p = '+' + p;
    return p.length >= 10 ? p : '';
  }

  // ── Gönderme ──────────────────────────────────────────────────────────────

  /** Başarısız alıcıları tekrar pending yapıp API gönderimini yeniden başlatır. */
  async retryFailedRecipients(
    schoolId: string,
    campaignId: string,
    requester?: { userId: string; role: string },
  ): Promise<{ started: boolean; total: number }> {
    const campaign = await this.getCampaign(schoolId, campaignId);
    if (requester?.role === UserRole.teacher && campaign.createdBy !== requester.userId) {
      throw new ForbiddenException('Bu kampanyayı siz oluşturmadınız.');
    }
    const settings = await this.settingsRepo.findOne({ where: { schoolId } });
    if (!settings) throw new BadRequestException('Mesaj ayarları bulunamadı.');
    if ((settings.provider as string) === 'whatsapp_link') {
      throw new BadRequestException('WhatsApp Web modu kaldırıldı. Okul yöneticisi API ayarlarını güncellemeli.');
    }
    if (campaign.status === 'sending') throw new BadRequestException('Gönderim devam ediyor; bitene kadar bekleyin.');
    const failedList = await this.recipientRepo.find({ where: { campaignId, status: 'failed' } });
    if (!failedList.length) throw new BadRequestException('Başarısız alıcı yok.');
    for (const r of failedList) {
      r.status = 'pending';
      r.errorMsg = null;
      await this.recipientRepo.save(r);
    }
    await this._syncCampaignCountsFromRecipients(campaignId);
    const pending = await this.recipientRepo.find({ where: { campaignId, status: 'pending' }, order: { sortOrder: 'ASC' } });
    if (!pending.length) throw new BadRequestException('Yeniden gönderilecek alıcı kalmadı.');
    const fresh = await this.getCampaign(schoolId, campaignId);
    const channel = this._campaignChannel(fresh);
    this._assertChannelReady(settings, channel, fresh);
    if (fresh.status === 'sending') {
      void this._sendAll(fresh, pending, settings);
      return { started: true, total: pending.length };
    }
    return this.executeCampaign(schoolId, campaignId, requester);
  }

  /** Arka planda çalışan toplu gönderimi durdurmayı talep eder (bir sonraki alıcıdan önce kontrol edilir). */
  async requestCampaignSendAbort(
    schoolId: string,
    campaignId: string,
    requester?: { userId: string; role: string },
  ): Promise<{ ok: boolean }> {
    const campaign = await this.getCampaign(schoolId, campaignId);
    if (requester?.role === UserRole.teacher && campaign.createdBy !== requester.userId) {
      throw new ForbiddenException('Bu kampanyayı siz oluşturmadınız.');
    }
    if (campaign.status !== 'sending') {
      throw new BadRequestException('Yalnızca gönderim sürerken durdurulabilir.');
    }
    campaign.metadata = { ...(campaign.metadata ?? {}), abortSend: true };
    await this.campaignRepo.save(campaign);
    return { ok: true };
  }

  async executeCampaign(
    schoolId: string,
    campaignId: string,
    requester?: { userId: string; role: string },
    opts?: ExecuteCampaignDto,
  ): Promise<{ started: boolean; total: number; channel: 'whatsapp' | 'sms' }> {
    const campaign = await this.getCampaign(schoolId, campaignId);
    if (requester?.role === UserRole.teacher && campaign.createdBy !== requester.userId) {
      throw new ForbiddenException('Bu kampanyayı siz oluşturmadınız.');
    }
    if (campaign.approvalStatus === 'pending') {
      throw new BadRequestException({ code: 'APPROVAL_PENDING', message: 'Kampanya yönetici onayı bekliyor.' });
    }
    if (campaign.approvalStatus === 'rejected') {
      throw new BadRequestException({ code: 'APPROVAL_REJECTED', message: 'Kampanya reddedildi.' });
    }
    if (campaign.status === 'sending') throw new BadRequestException('Gönderim zaten devam ediyor');
    if (campaign.metadata && (campaign.metadata as Record<string, unknown>).abortSend === true) {
      campaign.metadata = { ...(campaign.metadata ?? {}), abortSend: false };
      await this.campaignRepo.save(campaign);
    }
    const settings = await this.settingsRepo.findOne({ where: { schoolId } });
    const channel = opts?.channel === 'sms' ? 'sms' : opts?.channel === 'whatsapp' ? 'whatsapp' : this._campaignChannel(campaign);
    campaign.metadata = {
      ...(campaign.metadata ?? {}),
      channel,
      ...(opts?.smsHeader?.trim() ? { smsHeader: opts.smsHeader.trim().slice(0, 11) } : {}),
    };
    this._assertChannelReady(settings, channel, campaign);

    const recipients = await this.recipientRepo.find({ where: { campaignId, status: 'pending' }, order: { sortOrder: 'ASC' } });
    if (!recipients.length) throw new BadRequestException('Gönderilecek alıcı yok');

    campaign.status = 'sending';
    await this.campaignRepo.save(campaign);

    void this._sendAll(campaign, recipients, settings ?? this._mockSettings(schoolId));
    return { started: true, total: recipients.length, channel };
  }

  private _campaignChannel(campaign: MessagingCampaign): 'whatsapp' | 'sms' {
    const ch = (campaign.metadata as Record<string, unknown> | undefined)?.channel;
    return ch === 'sms' ? 'sms' : 'whatsapp';
  }

  private _assertChannelReady(
    settings: MessagingSettings | null,
    channel: 'whatsapp' | 'sms',
    campaign: MessagingCampaign,
  ): void {
    if (channel === 'sms') {
      const sms = parseSmsConfig(settings?.extraConfig);
      if (!smsConfigReady(sms)) {
        throw new BadRequestException({
          code: 'SMS_NOT_CONFIGURED',
          message: 'SMS entegrasyonu aktif değil. Ayarlar → SMS bölümünden Netgsm bilgilerini girin.',
        });
      }
      const hdr =
        String((campaign.metadata as Record<string, unknown>)?.smsHeader ?? '').trim() || sms.header;
      if (!hdr) throw new BadRequestException('SMS gönderici başlığı (msgheader) seçin veya ayarlarda tanımlayın.');
      const hasPdf =
        !!(campaign.attachmentPath && existsSync(campaign.attachmentPath));
      if (hasPdf) {
        throw new BadRequestException('SMS kanalında kampanya eki (PDF) gönderilemez; yalnızca metin.');
      }
      return;
    }
    if (settings && (settings.provider as string) === 'whatsapp_link') {
      throw new BadRequestException({
        message: 'WhatsApp Web modu kaldırıldı. Ayarlar → resmi API sağlayıcısı yapılandırın.',
        code: 'WHATSAPP_LINK_REMOVED',
      });
    }
    if (!settings?.isActive && settings?.provider !== 'mock') {
      throw new BadRequestException('WhatsApp entegrasyonu aktif değil. Ayarlar sayfasından yapılandırın.');
    }
  }

  async getCampaignStats(schoolId: string, campaignId: string) {
    const c = await this.getCampaign(schoolId, campaignId);
    const [total, sent, failed, pending] = await Promise.all([
      this.recipientRepo.count({ where: { campaignId } }),
      this.recipientRepo.count({ where: { campaignId, status: 'sent' } }),
      this.recipientRepo.count({ where: { campaignId, status: 'failed' } }),
      this.recipientRepo.count({ where: { campaignId, status: 'pending' } }),
    ]);
    return { ...c, total, sent, failed, pending };
  }

  async updateRecipient(schoolId: string, recipientId: string, dto: Partial<Pick<MessagingRecipient, 'phone' | 'recipientName' | 'messageText' | 'status'>>) {
    const r = await this.recipientRepo.findOne({ where: { id: recipientId } });
    if (!r) throw new NotFoundException();
    const c = await this.campaignRepo.findOne({ where: { id: r.campaignId, schoolId } });
    if (!c) throw new NotFoundException();
    Object.assign(r, dto);
    const saved = await this.recipientRepo.save(r);
    if (dto.status != null) await this._syncCampaignCountsFromRecipients(c.id);
    return saved;
  }

  private async _syncCampaignCountsFromRecipients(campaignId: string) {
    const c = await this.campaignRepo.findOne({ where: { id: campaignId } });
    if (!c) return;
    const [sent, failed, pending] = await Promise.all([
      this.recipientRepo.count({ where: { campaignId, status: 'sent' } }),
      this.recipientRepo.count({ where: { campaignId, status: 'failed' } }),
      this.recipientRepo.count({ where: { campaignId, status: 'pending' } }),
    ]);
    c.sentCount = sent;
    c.failedCount = failed;
    if (pending === 0) {
      c.status = failed > 0 && sent === 0 ? 'failed' : 'completed';
    } else if (sent > 0) {
      c.status = 'sending';
    } else {
      c.status = 'preview';
    }
    await this.campaignRepo.save(c);
    if (pending === 0) {
      const full = await this.campaignRepo.findOne({ where: { id: campaignId } });
      if (full) void this._notifyTeachersCampaignCompleted(full);
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async _saveCampaign(
    schoolId: string, userId: string, type: CampaignType, title: string,
    parsed: ParsedRecipient[], fileBuffer: Buffer | null, filename: string | null,
    metadata: Record<string, unknown>,
  ) {
    const settings = await this.settingsRepo.findOne({ where: { schoolId } });
    const creator = await this.userRepo.findOne({ where: { id: userId }, select: ['id', 'role'] });
    const ex = (settings?.extraConfig ?? {}) as Record<string, unknown>;
    const needApproval =
      ex.requireTeacherApproval === true && creator?.role === UserRole.teacher;

    const campaign = await this.campaignRepo.save(this.campaignRepo.create({
      schoolId,
      createdBy: userId,
      type,
      title,
      status: 'preview',
      totalCount: parsed.length,
      metadata,
      approvalStatus: needApproval ? 'pending' : 'none',
    }));

    if (fileBuffer && filename) {
      const dir = join(UPLOADS_DIR, campaign.id);
      mkdirSync(dir, { recursive: true });
      const fp = join(dir, filename);
      writeFileSync(fp, fileBuffer);
      campaign.filePath = fp;
      await this.campaignRepo.save(campaign);
    }

    const rows: MessagingRecipient[] = parsed.map((p) =>
      this.recipientRepo.create({
        campaignId: campaign.id,
        recipientName: p.recipientName,
        phone: p.phone,
        studentName: p.studentName,
        studentNumber: p.studentNumber,
        className: p.className,
        messageText: p.messageText,
        sortOrder: p.sortOrder ?? 0,
      }),
    );
    await this.recipientRepo.save(rows);
    void this.schoolNeeds.syncVeliDirectory(schoolId).catch(() => undefined);

    return campaign;
  }

  /** Alıcılar arası gecikme (ms) ve başarısız deneme sayısı — extraConfig */
  private _sendTuning(settings: MessagingSettings): { delayMs: number; maxRetries: number } {
    const ex = (settings.extraConfig ?? {}) as Record<string, unknown>;
    const rawDelay = Number(ex.send_delay_ms);
    const delayMs = Number.isFinite(rawDelay) ? Math.min(15000, Math.max(200, Math.floor(rawDelay))) : 600;
    const rawRetries = Number(ex.send_max_retries);
    const maxRetries = Number.isFinite(rawRetries) ? Math.min(4, Math.max(0, Math.floor(rawRetries))) : 1;
    return { delayMs, maxRetries };
  }

  private async _sendAll(campaign: MessagingCampaign, recipients: MessagingRecipient[], settings: MessagingSettings) {
    const { delayMs, maxRetries } = this._sendTuning(settings);
    const autoCfg = await this.schoolNeeds.getAutomationConfig(campaign.schoolId);
    const quiet = this.schoolNeeds.isQuietHoursNow(autoCfg);
    const channel = this._campaignChannel(campaign);
    const smsCfg = parseSmsConfig(settings.extraConfig);
    const smsHeader =
      String((campaign.metadata as Record<string, unknown>)?.smsHeader ?? '').trim() || smsCfg.header;
    const commonAttachment =
      channel === 'whatsapp' && campaign.attachmentPath && existsSync(campaign.attachmentPath)
        ? { buf: readFileSync(campaign.attachmentPath), name: campaign.attachmentName ?? 'ek.pdf' }
        : null;

    for (const r of recipients) {
      const ctrl = await this.campaignRepo.findOne({ where: { id: campaign.id } });
      if (ctrl?.metadata && (ctrl.metadata as Record<string, unknown>).abortSend === true) {
        ctrl.metadata = { ...(ctrl.metadata ?? {}), abortSend: false };
        await this.campaignRepo.save(ctrl);
        this.logger.log(`Kampanya ${campaign.id} gönderimi kullanıcı tarafından durduruldu.`);
        await this._syncCampaignCountsFromRecipients(campaign.id);
        const pendLeft = await this.recipientRepo.count({ where: { campaignId: campaign.id, status: 'pending' } });
        if (pendLeft > 0) {
          const cur = await this.campaignRepo.findOne({ where: { id: campaign.id } });
          if (cur) {
            cur.status = 'preview';
            await this.campaignRepo.save(cur);
          }
        }
        return;
      }

      if (!r.phone) {
        r.status = 'skipped';
        r.errorMsg = 'Telefon yok';
        await this.recipientRepo.save(r);
        continue;
      }

      if (quiet) {
        r.status = 'skipped';
        r.errorMsg = 'Sessiz saat (otomasyon ayarı)';
        await this.recipientRepo.save(r);
        continue;
      }

      if (await this._isOptedOut(campaign.schoolId, r.phone)) {
        r.status = 'skipped';
        r.errorMsg = 'İletişim listesinden çıkmış (opt-out)';
        await this.recipientRepo.save(r);
        continue;
      }

      const pref = await this.contactPrefRepo.findOne({
        where: { schoolId: campaign.schoolId, phone: this._normPhone(r.phone) },
      });
      let effectiveChannel = channel;
      if (pref) {
        if (effectiveChannel === 'sms' && pref.noSms) {
          r.status = 'skipped';
          r.errorMsg = 'Veli SMS istemiyor';
          await this.recipientRepo.save(r);
          continue;
        }
        if (effectiveChannel === 'whatsapp' && pref.noWhatsapp) {
          r.status = 'skipped';
          r.errorMsg = 'Veli WhatsApp istemiyor';
          await this.recipientRepo.save(r);
          continue;
        }
        if (!pref.noSms && !pref.noWhatsapp && pref.preferredChannel) {
          const hasPdf =
            !!(r.filePath && existsSync(r.filePath)) || !!commonAttachment;
          const allowed = allowedChannels(campaign.type, hasPdf);
          if (allowed.includes(pref.preferredChannel)) {
            effectiveChannel = pref.preferredChannel;
          }
        }
      }

      let messageText = r.messageText ?? '';
      if (campaign.createdBy) {
        const prefUser = await this.userPrefRepo.findOne({
          where: { userId: campaign.createdBy, schoolId: campaign.schoolId },
        });
        const sig = (prefUser?.preferences as Record<string, unknown> | undefined)?.appendSignature;
        if (typeof sig === 'string' && sig.trim() && !messageText.includes(sig.trim())) {
          messageText = `${messageText.trim()}\n\n${sig.trim()}`;
        }
      }

      let lastError = 'Hata';
      let ok = false;
      for (let attempt = 0; attempt <= maxRetries && !ok; attempt++) {
        if (attempt > 0) {
          const backoff = Math.min(8000, 400 * 2 ** (attempt - 1));
          await new Promise((res) => setTimeout(res, backoff));
        }
        try {
          let result: { success: boolean; error?: string; messageId?: string };
          if (effectiveChannel === 'sms') {
            if ((r.filePath && existsSync(r.filePath)) || commonAttachment) {
              lastError = 'SMS ile PDF/dosya gönderilemez';
              break;
            }
            result = await this.sms.sendText(smsCfg, r.phone, messageText, smsHeader);
          } else if (r.filePath && existsSync(r.filePath)) {
            const buf = readFileSync(r.filePath);
            result = await this.wa.sendDocument(
              settings,
              r.phone,
              messageText,
              buf,
              r.filePath.split(/[\\/]/).pop() ?? 'dosya.pdf',
            );
          } else if (commonAttachment) {
            result = await this.wa.sendDocument(
              settings,
              r.phone,
              messageText,
              commonAttachment.buf,
              commonAttachment.name,
            );
          } else {
            result = await this.wa.sendText(settings, r.phone, messageText);
          }
          if (result.success) {
            r.status = 'sent';
            r.sentAt = new Date();
            r.errorMsg = null;
            if (result.messageId) {
              r.providerMessageId = result.messageId;
              r.deliveryStatus = 'sent';
            }
            ok = true;
            if (result.messageId) {
              await this.deliveryRepo.save(
                this.deliveryRepo.create({
                  schoolId: campaign.schoolId,
                  campaignId: campaign.id,
                  recipientId: r.id,
                  provider: effectiveChannel === 'sms' ? 'sms' : (settings.provider ?? 'whatsapp'),
                  externalMessageId: result.messageId,
                  status: 'sent',
                  rawPayload: { source: 'send' },
                }),
              );
            }
          } else {
            lastError = result.error ?? 'Hata';
          }
        } catch (e) {
          lastError = String(e);
        }
      }
      if (!ok) {
        r.status = 'failed';
        r.errorMsg = lastError;
      }
      await this.recipientRepo.save(r);
      await new Promise((res) => setTimeout(res, delayMs));
    }

    await this._syncCampaignCountsFromRecipients(campaign.id);
    const done = await this.campaignRepo.findOne({ where: { id: campaign.id } });
    this.logger.log(
      `Kampanya ${campaign.id} gönderim turu bitti (durum: ${done?.status ?? '?'}, gönderilen: ${done?.sentCount ?? 0}, hatalı: ${done?.failedCount ?? 0}).`,
    );
  }

  /** Mesaj Gönderme Merkezi kampanyası bitince okul öğretmenlerine gelen kutusu */
  private async _notifyTeachersCampaignCompleted(campaign: MessagingCampaign): Promise<void> {
    const schoolId = campaign.schoolId;
    const teachers = await this.userRepo.find({
      where: { school_id: schoolId, role: UserRole.teacher },
      select: ['id'],
    });
    if (!teachers.length) return;
    const schoolName = (await this._getSchoolName(schoolId)).trim() || 'Okul';
    const sent = campaign.sentCount ?? 0;
    const failed = campaign.failedCount ?? 0;
    const parts = [`"${campaign.title}" tamamlandı.`, `${sent} gönderildi`];
    if (failed > 0) parts.push(`${failed} başarısız`);
    const body = `${schoolName} — ${parts.join('; ')}.`;
    for (const t of teachers) {
      await this.notificationsService.createInboxEntry({
        user_id: t.id,
        event_type: 'messaging.campaign_completed',
        entity_id: campaign.id,
        target_screen: 'mesaj-merkezi',
        title: 'Mesaj Gönderme Merkezi',
        body,
        metadata: { campaign_id: campaign.id, school_id: schoolId, campaign_type: campaign.type },
      });
    }
  }

  private _mockSettings(schoolId: string): MessagingSettings {
    const s = new MessagingSettings();
    s.schoolId = schoolId; s.provider = 'mock'; s.isActive = true;
    return s;
  }
}
