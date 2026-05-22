import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, IsNull, Repository } from 'typeorm';
import { MessagingSettings } from './entities/messaging-settings.entity';
import { MessagingCampaign } from './entities/messaging-campaign.entity';
import { MessagingRecipient } from './entities/messaging-recipient.entity';
import { MessagingInboundMessage } from './entities/messaging-inbound-message.entity';
import { MessagingVeliDirectory } from './entities/messaging-veli-directory.entity';
import { MessagingOptOut } from './entities/messaging-opt-out.entity';
import { School } from '../schools/entities/school.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../types/enums';
import { NotificationsService } from '../notifications/notifications.service';

export type SchoolAutomationConfig = {
  morningDevamsizlik?: { enabled?: boolean; hour?: number; minute?: number; channel?: 'whatsapp' | 'sms' };
  eokulReminder?: { enabled?: boolean; hour?: number };
  weeklyReport?: { enabled?: boolean; dayOfWeek?: number; hour?: number };
  quietHours?: { enabled?: boolean; startHour?: number; endHour?: number };
};

const DEFAULT_AUTOMATION: SchoolAutomationConfig = {
  morningDevamsizlik: { enabled: false, hour: 8, minute: 0, channel: 'whatsapp' },
  eokulReminder: { enabled: false, hour: 7 },
  weeklyReport: { enabled: false, dayOfWeek: 1, hour: 9 },
  quietHours: { enabled: true, startHour: 21, endHour: 8 },
};

@Injectable()
export class MessagingSchoolNeedsService {
  private readonly logger = new Logger(MessagingSchoolNeedsService.name);

  constructor(
    @InjectRepository(MessagingSettings) private readonly settingsRepo: Repository<MessagingSettings>,
    @InjectRepository(MessagingCampaign) private readonly campaignRepo: Repository<MessagingCampaign>,
    @InjectRepository(MessagingRecipient) private readonly recipientRepo: Repository<MessagingRecipient>,
    @InjectRepository(MessagingInboundMessage) private readonly inboundRepo: Repository<MessagingInboundMessage>,
    @InjectRepository(MessagingVeliDirectory) private readonly veliDirRepo: Repository<MessagingVeliDirectory>,
    @InjectRepository(MessagingOptOut) private readonly optOutRepo: Repository<MessagingOptOut>,
    @InjectRepository(School) private readonly schoolRepo: Repository<School>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
    @Inject(forwardRef(() => MessagingService))
    private readonly messaging: MessagingService,
  ) {}

  normPhone(phone: string): string {
    return phone.replace(/\D/g, '').replace(/^0/, '90');
  }

  async getAutomationConfig(schoolId: string): Promise<SchoolAutomationConfig> {
    const s = await this.settingsRepo.findOne({ where: { schoolId } });
    const ex = (s?.extraConfig ?? {}) as Record<string, unknown>;
    const a = (ex.automation ?? {}) as SchoolAutomationConfig;
    return {
      morningDevamsizlik: { ...DEFAULT_AUTOMATION.morningDevamsizlik, ...a.morningDevamsizlik },
      eokulReminder: { ...DEFAULT_AUTOMATION.eokulReminder, ...a.eokulReminder },
      weeklyReport: { ...DEFAULT_AUTOMATION.weeklyReport, ...a.weeklyReport },
      quietHours: { ...DEFAULT_AUTOMATION.quietHours, ...a.quietHours },
    };
  }

  async saveAutomationConfig(schoolId: string, patch: SchoolAutomationConfig): Promise<SchoolAutomationConfig> {
    let s = await this.settingsRepo.findOne({ where: { schoolId } });
    if (!s) {
      s = this.settingsRepo.create({ schoolId, provider: 'mock', isActive: false, extraConfig: {} });
    }
    const ex = { ...(s.extraConfig ?? {}) };
    ex.automation = { ...(ex.automation as object), ...patch };
    s.extraConfig = ex;
    await this.settingsRepo.save(s);
    return this.getAutomationConfig(schoolId);
  }

  isQuietHoursNow(config: SchoolAutomationConfig): boolean {
    const q = config.quietHours;
    if (!q?.enabled) return false;
    const start = q.startHour ?? 21;
    const end = q.endHour ?? 8;
    const h = new Date().getHours();
    if (start > end) return h >= start || h < end;
    return h >= start && h < end;
  }

  async syncVeliDirectory(schoolId: string): Promise<{ upserted: number }> {
    const rows: Array<{
      phone: string;
      recipient_name: string | null;
      student_name: string | null;
      class_name: string | null;
      student_number: string | null;
    }> = await this.dataSource.query(
      `SELECT DISTINCT ON (regexp_replace(COALESCE(r.phone,''), '\\D', '', 'g'), COALESCE(r.student_number,''))
              regexp_replace(COALESCE(r.phone,''), '\\D', '', 'g') AS phone,
              r.recipient_name, r.student_name, r.class_name, r.student_number
       FROM messaging_recipients r
       INNER JOIN messaging_campaigns c ON c.id = r.campaign_id
       WHERE c.school_id = $1 AND r.phone IS NOT NULL AND TRIM(r.phone) <> ''
       ORDER BY regexp_replace(COALESCE(r.phone,''), '\\D', '', 'g'), COALESCE(r.student_number,''),
                r.created_at DESC`,
      [schoolId],
    );
    let upserted = 0;
    for (const row of rows) {
      const phone = this.normPhone(row.phone);
      if (phone.length < 10) continue;
      let e = await this.veliDirRepo.findOne({
        where: { schoolId, phone, studentNumber: row.student_number ?? '' },
      });
      if (!e) {
        e = this.veliDirRepo.create({ schoolId, phone, studentNumber: row.student_number ?? '' });
      }
      e.contactName = row.recipient_name;
      e.studentName = row.student_name;
      e.className = row.class_name;
      e.source = 'campaign_sync';
      await this.veliDirRepo.save(e);
      upserted++;
    }
    return { upserted };
  }

  async listVeliDirectory(schoolId: string, q?: string, limit = 200) {
    const qb = this.veliDirRepo
      .createQueryBuilder('v')
      .where('v.school_id = :schoolId', { schoolId })
      .orderBy('v.updated_at', 'DESC')
      .take(limit);
    if (q?.trim()) {
      const like = `%${q.trim().replace(/\D/g, '')}%`;
      qb.andWhere(
        `(v.phone LIKE :like OR v.contact_name ILIKE :txt OR v.student_name ILIKE :txt OR v.class_name ILIKE :txt)`,
        { like, txt: `%${q.trim()}%` },
      );
    }
    return qb.getMany();
  }

  async getRiskList(schoolId: string) {
    const absenceRows: Array<{
      student_name: string;
      class_name: string;
      phone: string;
      cnt: string;
    }> = await this.dataSource.query(
      `SELECT COALESCE(r.student_name, '—') AS student_name,
              COALESCE(r.class_name, '—') AS class_name,
              regexp_replace(COALESCE(r.phone,''), '\\D', '', 'g') AS phone,
              COUNT(*)::text AS cnt
       FROM messaging_recipients r
       INNER JOIN messaging_campaigns c ON c.id = r.campaign_id
       WHERE c.school_id = $1
         AND c.type IN ('devamsizlik', 'ders_devamsizlik')
         AND r.status = 'sent'
         AND COALESCE(r.sent_at, r.created_at) >= NOW() - INTERVAL '30 days'
       GROUP BY r.student_name, r.class_name, regexp_replace(COALESCE(r.phone,''), '\\D', '', 'g')
       HAVING COUNT(*) >= 3
       ORDER BY COUNT(*) DESC
       LIMIT 50`,
      [schoolId],
    );

    const unreadRows: Array<{ phone: string; cnt: string }> = await this.dataSource.query(
      `SELECT regexp_replace(COALESCE(r.phone,''), '\\D', '', 'g') AS phone, COUNT(*)::text AS cnt
       FROM messaging_recipients r
       INNER JOIN messaging_campaigns c ON c.id = r.campaign_id
       WHERE c.school_id = $1
         AND r.status = 'sent'
         AND r.delivery_status IN ('sent', NULL)
         AND r.sent_at < NOW() - INTERVAL '2 days'
         AND r.sent_at >= NOW() - INTERVAL '14 days'
       GROUP BY regexp_replace(COALESCE(r.phone,''), '\\D', '', 'g')
       HAVING COUNT(*) >= 2
       LIMIT 30`,
      [schoolId],
    );

    const inboundNoReply: Array<{ phone: string; last_at: Date }> = await this.dataSource.query(
      `SELECT phone, MAX(received_at) AS last_at
       FROM messaging_inbound_messages
       WHERE school_id = $1 AND staff_reply IS NULL
         AND received_at >= NOW() - INTERVAL '7 days'
       GROUP BY phone
       ORDER BY MAX(received_at) DESC
       LIMIT 20`,
      [schoolId],
    );

    type RiskItem = {
      kind: string;
      studentName: string;
      className: string;
      phone: string;
      score: number;
      detail: string;
    };
    const items: RiskItem[] = absenceRows.map((r) => ({
      kind: 'devamsizlik',
      studentName: r.student_name,
      className: r.class_name,
      phone: r.phone,
      score: Number(r.cnt) * 10,
      detail: `${r.cnt} devamsızlık bildirimi (30 gün)`,
    }));

    for (const u of unreadRows) {
      items.push({
        kind: 'iletilmeyen',
        studentName: '—',
        className: '—',
        phone: u.phone,
        score: Number(u.cnt) * 5,
        detail: `${u.cnt} mesaj okunmadı/iletilmedi`,
      });
    }

    for (const i of inboundNoReply) {
      items.push({
        kind: 'yanit_bekliyor',
        studentName: '—',
        className: '—',
        phone: i.phone,
        score: 8,
        detail: 'Gelen mesaj — personel yanıtı yok',
      });
    }

    items.sort((a, b) => b.score - a.score);
    return { items: items.slice(0, 60), generatedAt: new Date().toISOString() };
  }

  async getWeeklyPrincipalReport(schoolId: string) {
    const to = new Date();
    const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
    const statRows: Array<{ status: string; cnt: string }> = await this.dataSource.query(
      `SELECT r.status, COUNT(*)::text AS cnt
       FROM messaging_recipients r
       INNER JOIN messaging_campaigns c ON c.id = r.campaign_id
       WHERE c.school_id = $1 AND c.created_at BETWEEN $2 AND $3
       GROUP BY r.status`,
      [schoolId, from, to],
    );
    const sent = Number(statRows.find((x) => x.status === 'sent')?.cnt ?? 0);
    const failed = Number(statRows.find((x) => x.status === 'failed')?.cnt ?? 0);
    const overview = {
      summary: { sent, failed, campaignsTotal: await this.campaignRepo.count({ where: { schoolId, createdAt: Between(from, to) } }) },
    };
    const risk = await this.getRiskList(schoolId);
    const optOutCount = await this.optOutRepo.count({ where: { schoolId } });
    const inboundCount = await this.inboundRepo.count({
      where: { schoolId, receivedAt: Between(from, to) },
    });
    const school = await this.schoolRepo.findOne({ where: { id: schoolId }, select: ['name'] });
    return {
      schoolName: school?.name ?? 'Okul',
      period: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
      overview,
      riskTop: risk.items.slice(0, 10),
      optOutCount,
      inboundCount,
      generatedAt: new Date().toISOString(),
    };
  }

  async getB2GOverview(fromIso?: string, toIso?: string) {
    const to = toIso ? new Date(`${toIso}T23:59:59.999`) : new Date();
    const from = fromIso
      ? new Date(`${fromIso}T00:00:00.000`)
      : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

    const rows: Array<{
      school_id: string;
      school_name: string;
      campaigns: string;
      sent: string;
      failed: string;
    }> = await this.dataSource.query(
      `SELECT c.school_id, COALESCE(s.name, c.school_id::text) AS school_name,
              COUNT(DISTINCT c.id)::text AS campaigns,
              SUM(CASE WHEN r.status = 'sent' THEN 1 ELSE 0 END)::text AS sent,
              SUM(CASE WHEN r.status = 'failed' THEN 1 ELSE 0 END)::text AS failed
       FROM messaging_campaigns c
       LEFT JOIN schools s ON s.id = c.school_id
       LEFT JOIN messaging_recipients r ON r.campaign_id = c.id
       WHERE c.created_at BETWEEN $1 AND $2
       GROUP BY c.school_id, s.name
       ORDER BY SUM(CASE WHEN r.status = 'sent' THEN 1 ELSE 0 END) DESC
       LIMIT 100`,
      [from, to],
    );

    return {
      period: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
      schools: rows.map((r) => ({
        schoolId: r.school_id,
        schoolName: r.school_name,
        campaigns: Number(r.campaigns),
        sent: Number(r.sent),
        failed: Number(r.failed),
      })),
    };
  }

  async getMissingPhonesReport(schoolId: string, campaignId?: string) {
    const params: unknown[] = [schoolId];
    let filter = " AND c.created_at >= NOW() - INTERVAL '14 days'";
    if (campaignId) {
      filter = ' AND c.id = $2';
      params.push(campaignId);
    }
    const missing: Array<{
      id: string;
      recipient_name: string | null;
      student_name: string | null;
      class_name: string | null;
      campaign_id: string;
      campaign_title: string;
      campaign_type: string;
    }> = await this.dataSource.query(
      `SELECT r.id, r.recipient_name, r.student_name, r.class_name,
              c.id AS campaign_id, c.title AS campaign_title, c.type AS campaign_type
       FROM messaging_recipients r
       INNER JOIN messaging_campaigns c ON c.id = r.campaign_id
       WHERE c.school_id = $1
         AND (r.phone IS NULL OR TRIM(r.phone) = ''
              OR LENGTH(regexp_replace(COALESCE(r.phone,''), '\\D', '', 'g')) < 10)
         ${filter}
       ORDER BY c.created_at DESC
       LIMIT 200`,
      params,
    );

    const campaigns = await this.campaignRepo.find({
      where: { schoolId },
      order: { createdAt: 'DESC' },
      take: 10,
      select: ['id', 'title', 'type', 'createdAt'],
    });

    return { missing, recentCampaigns: campaigns };
  }

  async getRsvpSummary(schoolId: string, campaignId: string) {
    const c = await this.campaignRepo.findOne({ where: { id: campaignId, schoolId } });
    if (!c) return null;
    if (!['veli_toplantisi', 'davetiye'].includes(c.type)) {
      return { error: 'RSVP yalnızca veli toplantısı / davetiye için' };
    }
    const rows = await this.recipientRepo.find({ where: { campaignId } });
    const yes = rows.filter((r) => r.rsvpStatus === 'yes').length;
    const no = rows.filter((r) => r.rsvpStatus === 'no').length;
    const pending = rows.length - yes - no;
    return {
      campaignId,
      total: rows.length,
      yes,
      no,
      pending,
      recipients: rows.map((r) => ({
        id: r.id,
        name: r.recipientName,
        phone: r.phone,
        rsvpStatus: r.rsvpStatus,
      })),
    };
  }

  async replyToInbound(schoolId: string, inboundId: string, userId: string, note: string) {
    const m = await this.inboundRepo.findOne({ where: { id: inboundId, schoolId } });
    if (!m) return null;
    m.staffReply = note.trim();
    m.staffRepliedAt = new Date();
    m.staffUserId = userId;
    return this.inboundRepo.save(m);
  }

  async tryParseRsvpFromInbound(schoolId: string, phone: string, body: string): Promise<boolean> {
    const norm = this.normPhone(phone);
    const suffix = norm.slice(-10);
    const t = body.trim().toLowerCase();
    let status: 'yes' | 'no' | null = null;
    if (/^(evet|e|katıl|katil|geliyorum|tamam)\b/.test(t) || t === '1') status = 'yes';
    else if (/^(hayır|hayir|h|gelmiyorum|yok)\b/.test(t) || t === '0') status = 'no';
    if (!status) return false;

    const campaigns = await this.campaignRepo.find({
      where: { schoolId },
      order: { createdAt: 'DESC' },
      take: 15,
    });
    const open = campaigns.find(
      (c) =>
        ['veli_toplantisi', 'davetiye'].includes(c.type) &&
        ['sending', 'completed', 'preview'].includes(c.status),
    );
    if (!open) return false;

    const recipient = await this.recipientRepo
      .createQueryBuilder('r')
      .where('r.campaign_id = :cid', { cid: open.id })
      .andWhere("regexp_replace(COALESCE(r.phone, ''), '\\\\D', '', 'g') LIKE :suf", { suf: `%${suffix}` })
      .getOne();
    if (!recipient) return false;
    recipient.rsvpStatus = status;
    await this.recipientRepo.save(recipient);
    this.logger.log(`RSVP ${status} — kampanya ${open.id}, tel ${norm}`);
    return true;
  }

  async getDashboardCounts(schoolId: string) {
    const pendingApprovals = await this.campaignRepo.count({
      where: { schoolId, approvalStatus: 'pending' },
    });
    const unreadInbound = await this.inboundRepo.count({
      where: { schoolId, staffReply: IsNull() },
    });
    const risk = await this.getRiskList(schoolId);
    return {
      pendingApprovals,
      unreadInbound,
      riskCount: risk.items.length,
    };
  }

  async runMorningDevamsizlikForSchool(schoolId: string): Promise<void> {
    const cfg = await this.getAutomationConfig(schoolId);
    if (!cfg.morningDevamsizlik?.enabled) return;

    const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const campaign = await this.campaignRepo.findOne({
      where: { schoolId, type: 'devamsizlik', status: 'preview' },
      order: { createdAt: 'DESC' },
    });
    if (!campaign || campaign.createdAt < since) return;
    if (campaign.approvalStatus === 'pending') return;

    const channel = cfg.morningDevamsizlik.channel ?? 'whatsapp';
    await this.messaging.executeScheduledCampaign(schoolId, campaign.id, channel);
    this.logger.log(`Sabah devamsızlık otomasyonu: ${campaign.id}`);
  }

  async runEokulReminderForSchool(schoolId: string): Promise<void> {
    const cfg = await this.getAutomationConfig(schoolId);
    if (!cfg.eokulReminder?.enabled) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const hasToday = await this.campaignRepo.findOne({
      where: { schoolId, type: 'devamsizlik' },
      order: { createdAt: 'DESC' },
    });
    if (hasToday && hasToday.createdAt >= today) return;

    const admins = await this.userRepo.find({
      where: { school_id: schoolId, role: UserRole.school_admin },
      select: ['id'],
    });
    const schoolName = (await this.schoolRepo.findOne({ where: { id: schoolId }, select: ['name'] }))?.name ?? 'Okul';
    for (const a of admins) {
      await this.notifications.createInboxEntry({
        user_id: a.id,
        event_type: 'messaging.eokul_reminder',
        title: 'Mesaj Merkezi — E-Okul',
        body: `${schoolName}: Bugün devamsızlık Excel yükleyip önizlemeyi hazırlayın (sabah otomasyonu için).`,
        target_screen: 'mesaj-merkezi',
        metadata: { school_id: schoolId },
      });
    }
  }

  async runWeeklyReportForSchool(schoolId: string): Promise<void> {
    const cfg = await this.getAutomationConfig(schoolId);
    if (!cfg.weeklyReport?.enabled) return;

    const report = await this.getWeeklyPrincipalReport(schoolId);
    const admins = await this.userRepo.find({
      where: { school_id: schoolId, role: UserRole.school_admin },
      select: ['id'],
    });
    const body = `${report.period.from}–${report.period.to}: ${report.overview.summary.sent} gönderildi, ${report.overview.summary.failed} hata, risk: ${report.riskTop.length} kayıt.`;
    for (const a of admins) {
      await this.notifications.createInboxEntry({
        user_id: a.id,
        event_type: 'messaging.weekly_report',
        title: 'Haftalık iletişim özeti',
        body,
        target_screen: 'mesaj-merkezi',
        metadata: { school_id: schoolId, report },
      });
    }
  }

  async runAllSchoolAutomations(kind: 'morning' | 'eokul' | 'weekly'): Promise<void> {
    const settings = await this.settingsRepo.find();
    for (const s of settings) {
      try {
        if (kind === 'morning') await this.runMorningDevamsizlikForSchool(s.schoolId);
        else if (kind === 'eokul') await this.runEokulReminderForSchool(s.schoolId);
        else await this.runWeeklyReportForSchool(s.schoolId);
      } catch (e) {
        this.logger.warn(`${kind} ${s.schoolId}: ${String(e)}`);
      }
    }
  }
}
