import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { MessagingSettings } from './entities/messaging-settings.entity';
import { MessagingCampaign, CampaignType } from './entities/messaging-campaign.entity';
import { MessagingRecipient } from './entities/messaging-recipient.entity';
import { MessagingContactGroup } from './entities/messaging-contact-group.entity';
import { MessagingGroupMember } from './entities/messaging-group-member.entity';
import { WhatsAppService } from './whatsapp.service';
import {
  parseTopluMesaj, parseEkDers, parseMaas,
  parseDevamsizlik, parseDersDevamsizlik, parseIzin, ParsedRecipient,
} from './parsers/excel-parsers';
import { parseMebbisPuantaj, parseEkDersBordro, parseMaasBordro, BordroTeacher } from './parsers/bordro-parsers';
import { splitPdfByPageCount } from './parsers/pdf-splitter';

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
    private readonly wa: WhatsAppService,
    private readonly dataSource: DataSource,
  ) {
    if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  // ── Ayarlar ───────────────────────────────────────────────────────────────

  async getSettings(schoolId: string) {
    return this.settingsRepo.findOne({ where: { schoolId } });
  }

  async saveSettings(schoolId: string, dto: Partial<MessagingSettings>) {
    let s = await this.settingsRepo.findOne({ where: { schoolId } });
    if (!s) { s = this.settingsRepo.create({ schoolId }); }
    Object.assign(s, dto);
    return this.settingsRepo.save(s);
  }

  async testConnection(schoolId: string, testPhone: string): Promise<{ ok: boolean; message: string }> {
    const s = await this.settingsRepo.findOne({ where: { schoolId } });
    if (!s) return { ok: false, message: 'Ayarlar bulunamadı' };
    const res = await this.wa.sendText(s, testPhone, '🔔 OgretmenPro — Bağlantı testi başarılı!');
    return { ok: res.success, message: res.error ?? 'Gönderildi' };
  }

  // ── Kampanyalar ────────────────────────────────────────────────────────────

  async listCampaigns(schoolId: string, limit = 30) {
    return this.campaignRepo.find({ where: { schoolId }, order: { createdAt: 'DESC' }, take: limit });
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

  async executeCampaign(schoolId: string, campaignId: string): Promise<{ started: boolean; total: number }> {
    const campaign = await this.getCampaign(schoolId, campaignId);
    if (campaign.status === 'sending') throw new BadRequestException('Gönderim zaten devam ediyor');
    const settings = await this.settingsRepo.findOne({ where: { schoolId } });
    if (!settings?.isActive && settings?.provider !== 'mock') {
      throw new BadRequestException('WhatsApp entegrasyonu aktif değil. Ayarlar sayfasından yapılandırın.');
    }

    const recipients = await this.recipientRepo.find({ where: { campaignId, status: 'pending' }, order: { sortOrder: 'ASC' } });
    if (!recipients.length) throw new BadRequestException('Gönderilecek alıcı yok');

    campaign.status = 'sending';
    await this.campaignRepo.save(campaign);

    // Async gönderim (arka planda)
    void this._sendAll(campaign, recipients, settings ?? this._mockSettings(schoolId));
    return { started: true, total: recipients.length };
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
    Object.assign(r, dto);
    return this.recipientRepo.save(r);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async _saveCampaign(
    schoolId: string, userId: string, type: CampaignType, title: string,
    parsed: ParsedRecipient[], fileBuffer: Buffer | null, filename: string | null,
    metadata: Record<string, unknown>,
  ) {
    const campaign = await this.campaignRepo.save(this.campaignRepo.create({
      schoolId, createdBy: userId, type, title,
      status: 'preview',
      totalCount: parsed.length,
      metadata,
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

    return campaign;
  }

  private async _sendAll(campaign: MessagingCampaign, recipients: MessagingRecipient[], settings: MessagingSettings) {
    let sent = 0; let failed = 0;
    // Kampanya düzeyinde ortak dosya eki
    const commonAttachment = campaign.attachmentPath && existsSync(campaign.attachmentPath)
      ? { buf: readFileSync(campaign.attachmentPath), name: campaign.attachmentName ?? 'ek.pdf' }
      : null;

    for (const r of recipients) {
      if (!r.phone) { r.status = 'skipped'; await this.recipientRepo.save(r); continue; }
      try {
        let result;
        if (r.filePath && existsSync(r.filePath)) {
          // Kişiye özel dosya (karne/mektup split)
          const buf = readFileSync(r.filePath);
          result = await this.wa.sendDocument(settings, r.phone, r.messageText ?? '', buf, r.filePath.split(/[\\/]/).pop() ?? 'dosya.pdf');
        } else if (commonAttachment) {
          // Ortak dosya eki (tüm alıcılara aynı)
          result = await this.wa.sendDocument(settings, r.phone, r.messageText ?? '', commonAttachment.buf, commonAttachment.name);
        } else {
          result = await this.wa.sendText(settings, r.phone, r.messageText ?? '');
        }
        if (result.success) { r.status = 'sent'; r.sentAt = new Date(); sent++; }
        else { r.status = 'failed'; r.errorMsg = result.error ?? 'Hata'; failed++; }
      } catch (e) { r.status = 'failed'; r.errorMsg = String(e); failed++; }
      await this.recipientRepo.save(r);
      // Rate limiting
      await new Promise((res) => setTimeout(res, 200));
    }
    campaign.sentCount  += sent;
    campaign.failedCount += failed;
    campaign.status = failed > 0 && sent === 0 ? 'failed' : failed > 0 ? 'completed' : 'completed';
    await this.campaignRepo.save(campaign);
    this.logger.log(`Kampanya ${campaign.id} tamamlandı: ${sent} gönderildi, ${failed} hatalı`);
  }

  private _mockSettings(schoolId: string): MessagingSettings {
    const s = new MessagingSettings();
    s.schoolId = schoolId; s.provider = 'mock'; s.isActive = true;
    return s;
  }
}
