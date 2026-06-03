import {
  BadRequestException, Body, Controller, Delete, Get, Param,
  Patch, Post, Query, Res, UploadedFile, UploadedFiles, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequireSchoolModuleGuard } from '../common/guards/require-school-module.guard';
import { RequireSchoolModule } from '../common/decorators/require-school-module.decorator';
import { RequireModuleActivationGuard } from '../market/guards/require-module-activation.guard';
import { UserRole } from '../types/enums';
import { MessagingService } from './messaging.service';
import { MessagingSchoolNeedsService, type SchoolAutomationConfig } from './messaging-school-needs.service';
import {
  SaveSettingsDto, TestConnectionDto, TestSmsConnectionDto, ExecuteCampaignDto,
  CreateManualCampaignDto,
  CreateExcelCampaignDto, CreatePdfSplitCampaignDto,
  PatchTeacherMessagingPreferencesDto,
} from './dto/messaging.dto';
import {
  TPL_ARA_KARNE,
  TPL_DEVAMSIZLIK,
  TPL_DEVAMSIZLIK_MEKTUP,
  TPL_DERS_DEVAMSIZLIK,
  TPL_EK_DERS,
  TPL_IZIN,
  TPL_KARNE,
  TPL_MAAS,
  TPL_VELI_ILETISIM,
} from './default-message-templates';

@Controller('messaging')
@UseGuards(JwtAuthGuard, RolesGuard, RequireSchoolModuleGuard, RequireModuleActivationGuard)
@RequireSchoolModule('messaging')
export class MessagingController {
  constructor(
    private readonly svc: MessagingService,
    private readonly schoolNeeds: MessagingSchoolNeedsService,
  ) {}

  private sid(p: CurrentUserPayload, q?: string): string {
    if (p.role === UserRole.superadmin || p.role === UserRole.moderator) {
      if (!q?.trim()) throw new BadRequestException({ code: 'SCHOOL_ID' });
      return q.trim();
    }
    if (!p.schoolId) throw new BadRequestException({ code: 'NO_SCHOOL' });
    return p.schoolId;
  }

  // ── Ayarlar ───────────────────────────────────────────────────────────────

  @Get('settings')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  getSettings(@CurrentUser() p: CurrentUserPayload, @Query('school_id') q?: string) {
    return this.svc.getSettings(this.sid(p, q));
  }

  @Post('settings')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  saveSettings(@CurrentUser() p: CurrentUserPayload, @Query('school_id') q: string | undefined, @Body() dto: SaveSettingsDto) {
    return this.svc.saveSettings(this.sid(p, q), dto);
  }

  @Post('settings/test')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  testConnection(@CurrentUser() p: CurrentUserPayload, @Query('school_id') q: string | undefined, @Body() dto: TestConnectionDto) {
    return this.svc.testConnection(this.sid(p, q), dto.testPhone);
  }

  @Post('settings/sms/test')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  testSmsConnection(
    @CurrentUser() p: CurrentUserPayload,
    @Query('school_id') q: string | undefined,
    @Body() dto: TestSmsConnectionDto,
  ) {
    return this.svc.testSmsConnection(this.sid(p, q), dto.testPhone, dto.testMessage);
  }

  @Get('delivery-hint')
  @Roles(UserRole.school_admin, UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  deliveryHint(@CurrentUser() p: CurrentUserPayload, @Query('school_id') q?: string) {
    return this.svc.getDeliveryHint(this.sid(p, q));
  }

  /** Kişisel gönderim tercihleri (imza, wa.me sekme) — okul başına */
  @Get('me/preferences')
  @Roles(UserRole.school_admin, UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  getMyMessagingPreferences(@CurrentUser() p: CurrentUserPayload, @Query('school_id') q?: string) {
    return this.svc.getTeacherMessagingPreferences(p.userId, this.sid(p, q));
  }

  @Patch('me/preferences')
  @Roles(UserRole.teacher)
  patchMyMessagingPreferences(
    @CurrentUser() p: CurrentUserPayload,
    @Query('school_id') q: string | undefined,
    @Body() dto: PatchTeacherMessagingPreferencesDto,
  ) {
    return this.svc.saveTeacherMessagingPreferences(p.userId, this.sid(p, q), dto);
  }

  // ── Kampanyalar listesi ────────────────────────────────────────────────────

  @Get('reports/overview')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  reportsOverview(
    @CurrentUser() p: CurrentUserPayload,
    @Query('school_id') q?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.svc.getReportsOverview(this.sid(p, q), from, to);
  }

  @Get('reports/risk')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  riskReport(@CurrentUser() p: CurrentUserPayload, @Query('school_id') q?: string) {
    return this.schoolNeeds.getRiskList(this.sid(p, q));
  }

  @Get('reports/weekly-principal')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  weeklyPrincipal(@CurrentUser() p: CurrentUserPayload, @Query('school_id') q?: string) {
    return this.schoolNeeds.getWeeklyPrincipalReport(this.sid(p, q));
  }

  @Get('reports/b2g')
  @Roles(UserRole.superadmin, UserRole.moderator)
  b2gOverview(
    @CurrentUser() p: CurrentUserPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (p.role !== UserRole.superadmin && p.role !== UserRole.moderator) {
      throw new BadRequestException('Yetkisiz');
    }
    return this.schoolNeeds.getB2GOverview(from, to);
  }

  @Get('reports/missing-phones')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  missingPhones(
    @CurrentUser() p: CurrentUserPayload,
    @Query('school_id') q?: string,
    @Query('campaign_id') campaignId?: string,
  ) {
    return this.schoolNeeds.getMissingPhonesReport(this.sid(p, q), campaignId);
  }

  @Get('dashboard/counts')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  dashboardCounts(@CurrentUser() p: CurrentUserPayload, @Query('school_id') q?: string) {
    return this.schoolNeeds.getDashboardCounts(this.sid(p, q));
  }

  @Get('automation/config')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  getAutomation(@CurrentUser() p: CurrentUserPayload, @Query('school_id') q?: string) {
    return this.schoolNeeds.getAutomationConfig(this.sid(p, q));
  }

  @Post('automation/config')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  saveAutomation(
    @CurrentUser() p: CurrentUserPayload,
    @Query('school_id') q: string | undefined,
    @Body() body: SchoolAutomationConfig,
  ) {
    return this.schoolNeeds.saveAutomationConfig(this.sid(p, q), body);
  }

  @Get('veli-directory')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  veliDirectory(
    @CurrentUser() p: CurrentUserPayload,
    @Query('school_id') q?: string,
    @Query('q') search?: string,
  ) {
    return this.schoolNeeds.listVeliDirectory(this.sid(p, q), search);
  }

  @Post('veli-directory/sync')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  syncVeliDirectory(@CurrentUser() p: CurrentUserPayload, @Query('school_id') q?: string) {
    return this.schoolNeeds.syncVeliDirectory(this.sid(p, q));
  }

  @Post('inbound/:id/reply')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  replyInbound(
    @CurrentUser() p: CurrentUserPayload,
    @Param('id') id: string,
    @Query('school_id') q: string | undefined,
    @Body() body: { note: string },
  ) {
    if (!body.note?.trim()) throw new BadRequestException('note gerekli');
    return this.schoolNeeds.replyToInbound(this.sid(p, q), id, p.userId, body.note);
  }

  @Get('reports/export')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  async reportsExport(
    @CurrentUser() p: CurrentUserPayload,
    @Query('school_id') q: string | undefined,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Res() res: Response,
  ) {
    const csv = await this.svc.exportReportsCsv(this.sid(p, q), from, to);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="mesaj-rapor.csv"');
    res.send(csv);
  }

  @Get('templates')
  @Roles(UserRole.school_admin, UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  listTemplates(@CurrentUser() p: CurrentUserPayload, @Query('school_id') q?: string) {
    return this.svc.listTemplates(this.sid(p, q));
  }

  @Post('templates')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  saveTemplate(
    @CurrentUser() p: CurrentUserPayload,
    @Query('school_id') q: string | undefined,
    @Body() body: { id?: string; campaignType: string; title: string; body: string; variables?: string },
  ) {
    return this.svc.saveTemplate(this.sid(p, q), body);
  }

  @Delete('templates/:id')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  deleteTemplate(@CurrentUser() p: CurrentUserPayload, @Param('id') id: string, @Query('school_id') q?: string) {
    return this.svc.deleteTemplate(this.sid(p, q), id);
  }

  @Get('opt-outs')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  listOptOuts(@CurrentUser() p: CurrentUserPayload, @Query('school_id') q?: string) {
    return this.svc.listOptOuts(this.sid(p, q));
  }

  @Post('opt-outs')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  addOptOut(
    @CurrentUser() p: CurrentUserPayload,
    @Query('school_id') q: string | undefined,
    @Body() body: { phone: string; reason?: string },
  ) {
    return this.svc.addOptOut(this.sid(p, q), body.phone, body.reason);
  }

  @Delete('opt-outs/:id')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  removeOptOut(@CurrentUser() p: CurrentUserPayload, @Param('id') id: string, @Query('school_id') q?: string) {
    return this.svc.removeOptOut(this.sid(p, q), id);
  }

  @Get('contact-preferences')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  listContactPrefs(@CurrentUser() p: CurrentUserPayload, @Query('school_id') q?: string) {
    return this.svc.listContactPreferences(this.sid(p, q));
  }

  @Post('contact-preferences')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  upsertContactPref(
    @CurrentUser() p: CurrentUserPayload,
    @Query('school_id') q: string | undefined,
    @Body()
    body: {
      phone: string;
      name?: string;
      preferredChannel?: 'whatsapp' | 'sms';
      noSms?: boolean;
      noWhatsapp?: boolean;
      quietHoursNote?: string;
    },
  ) {
    return this.svc.upsertContactPreference(this.sid(p, q), body);
  }

  @Get('contacts/history')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  contactHistory(
    @CurrentUser() p: CurrentUserPayload,
    @Query('school_id') q: string | undefined,
    @Query('phone') phone: string,
  ) {
    if (!phone?.trim()) throw new BadRequestException('phone gerekli');
    return this.svc.getContactHistory(this.sid(p, q), phone);
  }

  @Get('contacts/diary')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  contactDiary(
    @CurrentUser() p: CurrentUserPayload,
    @Query('school_id') q: string | undefined,
    @Query('phone') phone: string,
  ) {
    if (!phone?.trim()) throw new BadRequestException('phone gerekli');
    return this.svc.getCommunicationDiary(this.sid(p, q), phone);
  }

  @Get('contacts/recent')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  recentContacts(@CurrentUser() p: CurrentUserPayload, @Query('school_id') q?: string) {
    return this.svc.listRecentCommunicationPhones(this.sid(p, q));
  }

  @Get('approvals/pending')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  pendingApprovals(@CurrentUser() p: CurrentUserPayload, @Query('school_id') q?: string) {
    return this.svc.listPendingApprovals(this.sid(p, q));
  }

  @Post('campaigns/:id/approve')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  approve(@CurrentUser() p: CurrentUserPayload, @Param('id') id: string, @Query('school_id') q?: string) {
    return this.svc.approveCampaign(this.sid(p, q), id, p.userId);
  }

  @Post('campaigns/:id/reject')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  reject(
    @CurrentUser() p: CurrentUserPayload,
    @Param('id') id: string,
    @Query('school_id') q: string | undefined,
    @Body() body: { reason?: string },
  ) {
    return this.svc.rejectCampaign(this.sid(p, q), id, p.userId, body.reason);
  }

  @Post('campaigns/:id/schedule')
  @Roles(UserRole.school_admin, UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  schedule(
    @CurrentUser() p: CurrentUserPayload,
    @Param('id') id: string,
    @Query('school_id') q: string | undefined,
    @Body() body: { at: string } & ExecuteCampaignDto,
  ) {
    return this.svc.scheduleCampaign(this.sid(p, q), id, body.at, body, { userId: p.userId, role: p.role });
  }

  @Delete('campaigns/:id/schedule')
  @Roles(UserRole.school_admin, UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  cancelSchedule(@CurrentUser() p: CurrentUserPayload, @Param('id') id: string, @Query('school_id') q?: string) {
    return this.svc.cancelSchedule(this.sid(p, q), id);
  }

  @Get('campaigns/:id/rsvp')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  rsvpSummary(@CurrentUser() p: CurrentUserPayload, @Param('id') id: string, @Query('school_id') q?: string) {
    return this.schoolNeeds.getRsvpSummary(this.sid(p, q), id);
  }

  @Post('campaigns/acil')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  createAcil(
    @CurrentUser() p: CurrentUserPayload,
    @Query('school_id') q: string | undefined,
    @Body() body: { title?: string; message: string; recipients: Array<{ name?: string; phone: string }> },
  ) {
    if (!body.message?.trim()) throw new BadRequestException('message gerekli');
    return this.svc.createAcilCampaign(this.sid(p, q), p.userId, body.title ?? '', body.message, body.recipients ?? []);
  }

  @Get('campaigns/:id/export')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  async campaignExport(
    @CurrentUser() p: CurrentUserPayload,
    @Param('id') id: string,
    @Query('school_id') q: string | undefined,
    @Res() res: Response,
  ) {
    const csv = await this.svc.exportCampaignCsv(this.sid(p, q), id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="kampanya-${id.slice(0, 8)}.csv"`);
    res.send(csv);
  }

  @Get('channel-rules')
  @Roles(UserRole.school_admin, UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  channelRules(
    @Query('type') type: string,
    @Query('has_attachment') hasAttachment?: string,
  ) {
    return this.svc.getChannelRulesForType(type as never, hasAttachment === '1' || hasAttachment === 'true');
  }

  @Get('campaigns')
  @Roles(UserRole.school_admin, UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  list(@CurrentUser() p: CurrentUserPayload, @Query('school_id') q?: string) {
    return this.svc.listCampaigns(this.sid(p, q));
  }

  @Get('campaigns/:id')
  @Roles(UserRole.school_admin, UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  get(@CurrentUser() p: CurrentUserPayload, @Param('id') id: string, @Query('school_id') q?: string) {
    return this.svc.getCampaignStats(this.sid(p, q), id);
  }

  @Delete('campaigns/:id')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  deleteCampaign(@CurrentUser() p: CurrentUserPayload, @Param('id') id: string, @Query('school_id') q?: string) {
    return this.svc.deleteCampaign(this.sid(p, q), id);
  }

  @Get('campaigns/:id/recipients')
  @Roles(UserRole.school_admin, UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  recipients(@CurrentUser() p: CurrentUserPayload, @Param('id') id: string, @Query('school_id') q?: string) {
    return this.svc.listRecipients(this.sid(p, q), id);
  }

  @Patch('recipients/:id')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  updateRecipient(@CurrentUser() p: CurrentUserPayload, @Param('id') id: string, @Query('school_id') q: string | undefined, @Body() body: { phone?: string; messageText?: string; recipientName?: string }) {
    const sid = this.sid(p, q); void sid;
    return this.svc.updateRecipient(this.sid(p, q), id, body);
  }

  @Post('campaigns/:id/execute')
  @Roles(UserRole.school_admin, UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  execute(
    @CurrentUser() p: CurrentUserPayload,
    @Param('id') id: string,
    @Query('school_id') q?: string,
    @Body() body?: ExecuteCampaignDto,
  ) {
    return this.svc.executeCampaign(this.sid(p, q), id, { userId: p.userId, role: p.role }, body);
  }

  @Post('campaigns/:id/retry-failed')
  @Roles(UserRole.school_admin, UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  retryFailed(@CurrentUser() p: CurrentUserPayload, @Param('id') id: string, @Query('school_id') q?: string) {
    return this.svc.retryFailedRecipients(this.sid(p, q), id, { userId: p.userId, role: p.role });
  }

  @Post('campaigns/:id/abort-send')
  @Roles(UserRole.school_admin, UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  abortSend(@CurrentUser() p: CurrentUserPayload, @Param('id') id: string, @Query('school_id') q?: string) {
    return this.svc.requestCampaignSendAbort(this.sid(p, q), id, { userId: p.userId, role: p.role });
  }

  // ── Manuel / Toplu ────────────────────────────────────────────────────────

  @Post('campaigns/toplu-mesaj/manual')
  @Roles(UserRole.school_admin, UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  manualCampaign(@CurrentUser() p: CurrentUserPayload, @Query('school_id') q: string | undefined, @Body() dto: CreateManualCampaignDto) {
    return this.svc.createManualCampaign(this.sid(p, q), p.userId, dto.title, dto.recipients);
  }

  @Post('campaigns/toplu-mesaj/excel')
  @Roles(UserRole.school_admin, UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  @UseInterceptors(FileInterceptor('file'))
  topluExcel(@CurrentUser() p: CurrentUserPayload, @Query('school_id') q: string | undefined, @Body() body: CreateExcelCampaignDto, @UploadedFile() file: Express.Multer.File | undefined) {
    if (!file?.buffer?.length) throw new BadRequestException('Excel dosyası gerekli');
    return this.svc.createTopluMesajCampaign(this.sid(p, q), p.userId, body.title, body.template ?? TPL_VELI_ILETISIM, file.buffer, file.originalname);
  }

  // ── Ek Ders ───────────────────────────────────────────────────────────────

  @Post('campaigns/ek-ders/excel')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  @UseInterceptors(FileInterceptor('file'))
  ekDers(@CurrentUser() p: CurrentUserPayload, @Query('school_id') q: string | undefined, @Body() body: CreateExcelCampaignDto, @UploadedFile() file: Express.Multer.File | undefined) {
    if (!file?.buffer?.length) throw new BadRequestException('Excel dosyası gerekli');
    const tpl = body.template ?? TPL_EK_DERS;
    return this.svc.createEkDersCampaign(this.sid(p, q), p.userId, body.title, tpl, file.buffer, file.originalname);
  }

  // ── Maaş ──────────────────────────────────────────────────────────────────

  @Post('campaigns/maas/excel')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  @UseInterceptors(FileInterceptor('file'))
  maas(@CurrentUser() p: CurrentUserPayload, @Query('school_id') q: string | undefined, @Body() body: CreateExcelCampaignDto, @UploadedFile() file: Express.Multer.File | undefined) {
    if (!file?.buffer?.length) throw new BadRequestException('Excel dosyası gerekli');
    const tpl = body.template ?? TPL_MAAS;
    return this.svc.createMaasCampaign(this.sid(p, q), p.userId, body.title, tpl, file.buffer, file.originalname);
  }

  // ── Günlük Devamsızlık ────────────────────────────────────────────────────

  @Post('campaigns/devamsizlik/excel')
  @Roles(UserRole.school_admin, UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  @UseInterceptors(FileInterceptor('file'))
  devamsizlik(@CurrentUser() p: CurrentUserPayload, @Query('school_id') q: string | undefined, @Body() body: CreateExcelCampaignDto, @UploadedFile() file: Express.Multer.File | undefined) {
    if (!file?.buffer?.length) throw new BadRequestException('Excel dosyası gerekli');
    const tpl = body.template ?? TPL_DEVAMSIZLIK;
    return this.svc.createDevamsizlikCampaign(this.sid(p, q), p.userId, body.title, tpl, body.tarih ?? new Date().toLocaleDateString('tr-TR'), file.buffer, file.originalname);
  }

  // ── Devamsızlık Mektubu / Karne (PDF split) ──────────────────────────────

  @Post('campaigns/devamsizlik-mektup/pdf')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  @UseInterceptors(FileInterceptor('file'))
  devamsizlikMektup(@CurrentUser() p: CurrentUserPayload, @Query('school_id') q: string | undefined, @Body() body: CreatePdfSplitCampaignDto, @UploadedFile() file: Express.Multer.File | undefined) {
    if (!file?.buffer?.length) throw new BadRequestException('PDF dosyası gerekli');
    const tpl = body.template ?? TPL_DEVAMSIZLIK_MEKTUP;
    return this.svc.createPdfSplitCampaign(this.sid(p, q), p.userId, 'devamsizlik_mektup', body.title, tpl, file.buffer, file.originalname, body.recipients, body.pagesPerStudent);
  }

  @Post('campaigns/karne/pdf')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  @UseInterceptors(FileInterceptor('file'))
  karne(@CurrentUser() p: CurrentUserPayload, @Query('school_id') q: string | undefined, @Body() body: CreatePdfSplitCampaignDto, @UploadedFile() file: Express.Multer.File | undefined) {
    if (!file?.buffer?.length) throw new BadRequestException('PDF dosyası gerekli');
    const tpl = body.template ?? TPL_KARNE;
    return this.svc.createPdfSplitCampaign(this.sid(p, q), p.userId, 'karne', body.title, tpl, file.buffer, file.originalname, body.recipients, body.pagesPerStudent);
  }

  @Post('campaigns/ara-karne/pdf')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  @UseInterceptors(FileInterceptor('file'))
  araKarne(@CurrentUser() p: CurrentUserPayload, @Query('school_id') q: string | undefined, @Body() body: CreatePdfSplitCampaignDto, @UploadedFile() file: Express.Multer.File | undefined) {
    if (!file?.buffer?.length) throw new BadRequestException('PDF dosyası gerekli');
    const tpl = body.template ?? TPL_ARA_KARNE;
    return this.svc.createPdfSplitCampaign(this.sid(p, q), p.userId, 'ara_karne', body.title, tpl, file.buffer, file.originalname, body.recipients, body.pagesPerStudent);
  }

  // ── Ders Bazlı Devamsızlık ─────────────────────────────────────────────────

  @Post('campaigns/ders-devamsizlik/excel')
  @Roles(UserRole.school_admin, UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  @UseInterceptors(FileInterceptor('file'))
  dersDevamsizlik(@CurrentUser() p: CurrentUserPayload, @Query('school_id') q: string | undefined, @Body() body: CreateExcelCampaignDto, @UploadedFile() file: Express.Multer.File | undefined) {
    if (!file?.buffer?.length) throw new BadRequestException('Excel dosyası gerekli');
    const tpl = body.template ?? TPL_DERS_DEVAMSIZLIK;
    return this.svc.createDersDevamsizlikCampaign(this.sid(p, q), p.userId, body.title, tpl, body.tarih ?? new Date().toLocaleDateString('tr-TR'), file.buffer, file.originalname);
  }

  // ── Evci / Çarşı İzin ─────────────────────────────────────────────────────

  @Post('campaigns/izin/excel')
  @Roles(UserRole.school_admin, UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  @UseInterceptors(FileInterceptor('file'))
  izin(@CurrentUser() p: CurrentUserPayload, @Query('school_id') q: string | undefined, @Body() body: CreateExcelCampaignDto, @UploadedFile() file: Express.Multer.File | undefined) {
    if (!file?.buffer?.length) throw new BadRequestException('Excel dosyası gerekli');
    const tpl = body.template ?? TPL_IZIN;
    return this.svc.createIzinCampaign(this.sid(p, q), p.userId, body.title, tpl, body.tarih ?? new Date().toLocaleDateString('tr-TR'), file.buffer, file.originalname);
  }

  // ── Veli Toplantısı ───────────────────────────────────────────────────────

  @Post('campaigns/veli-toplantisi')
  @Roles(UserRole.school_admin, UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  @UseInterceptors(FileInterceptor('attachment'))
  async veliToplantisi(
    @CurrentUser() p: CurrentUserPayload, @Query('school_id') q: string | undefined,
    @Body() body: { title: string; message: string; source: 'excel' | 'group' | 'manual'; groupId?: string; recipients?: string },
    @UploadedFile() attachment?: Express.Multer.File,
  ) {
    const sid = this.sid(p, q);
    const manual = body.recipients ? JSON.parse(body.recipients) as Array<{ name: string; phone: string }> : undefined;
    return this.svc.createSimpleCampaign(sid, p.userId, 'veli_toplantisi', body.title, body.message, body.source, undefined, undefined, body.groupId, manual, attachment?.buffer, attachment?.originalname);
  }

  @Post('campaigns/veli-toplantisi/excel')
  @Roles(UserRole.school_admin, UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  @UseInterceptors(FileInterceptor('file'))
  async veliToplantisiExcel(
    @CurrentUser() p: CurrentUserPayload, @Query('school_id') q: string | undefined,
    @Body() body: { title: string; message: string },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file?.buffer?.length) throw new BadRequestException('Excel dosyası gerekli');
    return this.svc.createSimpleCampaign(this.sid(p, q), p.userId, 'veli_toplantisi', body.title, body.message, 'excel', file.buffer, file.originalname);
  }

  // ── Davetiye ──────────────────────────────────────────────────────────────

  @Post('campaigns/davetiye')
  @Roles(UserRole.school_admin, UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  @UseInterceptors(FileInterceptor('attachment'))
  async davetiye(
    @CurrentUser() p: CurrentUserPayload,
    @Query('school_id') q: string | undefined,
    @Body() body: { title: string; message: string; source: 'group'; groupId: string },
    @UploadedFile() attachment?: Express.Multer.File,
  ) {
    if (!body.groupId) throw new BadRequestException('Grup seçin');
    return this.svc.createSimpleCampaign(
      this.sid(p, q),
      p.userId,
      'davetiye',
      body.title,
      body.message,
      'group',
      undefined,
      undefined,
      body.groupId,
      undefined,
      attachment?.buffer,
      attachment?.originalname,
    );
  }

  @Post('campaigns/davetiye/excel')
  @Roles(UserRole.school_admin, UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  @UseInterceptors(FileInterceptor('file'))
  async davetiyeExcel(
    @CurrentUser() p: CurrentUserPayload, @Query('school_id') q: string | undefined,
    @Body() body: { title: string; message: string },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file?.buffer?.length) throw new BadRequestException('Excel dosyası gerekli');
    return this.svc.createSimpleCampaign(this.sid(p, q), p.userId, 'davetiye', body.title, body.message, 'excel', file.buffer, file.originalname);
  }

  // ── MEBBİS/KBS Bordro ─────────────────────────────────────────────────────

  @Post('bordro/parse')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  @UseInterceptors(FileInterceptor('file'))
  async parseBordro(
    @CurrentUser() p: CurrentUserPayload, @Query('school_id') q: string | undefined,
    @Query('type') type: 'mebbis_puantaj' | 'ek_ders_bordro' | 'maas_bordro',
    @Query('donem') donem: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file?.buffer?.length) throw new BadRequestException('Excel dosyası gerekli');
    return this.svc.parseBordro(this.sid(p, q), type, file.buffer, donem ?? '');
  }

  @Post('bordro/campaign')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  @UseInterceptors(FileInterceptor('file'))
  async createBordroCampaign(
    @CurrentUser() p: CurrentUserPayload, @Query('school_id') q: string | undefined,
    @Query('type') type: 'mebbis_puantaj' | 'ek_ders_bordro' | 'maas_bordro',
    @Body() body: { title: string; donem: string; manualPhones?: string; schoolName?: string; footerNote?: string },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file?.buffer?.length) throw new BadRequestException('Excel dosyası gerekli');
    const manualPhones = body.manualPhones ? JSON.parse(body.manualPhones) as Record<string, string> : {};
    return this.svc.createBordroCampaign(this.sid(p, q), p.userId, type, body.title, body.donem, file.buffer, file.originalname, manualPhones, body.schoolName, body.footerNote);
  }

  @Post('bordro/compare')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'mebbisFile', maxCount: 1 },
      { name: 'kbsFile', maxCount: 1 },
    ]),
  )
  async compareBordro(
    @CurrentUser() p: CurrentUserPayload,
    @Query('school_id') q: string | undefined,
    @UploadedFiles()
    files: { mebbisFile?: Express.Multer.File[]; kbsFile?: Express.Multer.File[] },
    @Body() body?: { mebbisJson?: string; kbsJson?: string },
  ) {
    const mebbisF = files.mebbisFile?.[0];
    const kbsF = files.kbsFile?.[0];
    if (body?.mebbisJson && body?.kbsJson) {
      const mebbis = JSON.parse(body.mebbisJson) as { headers: string[]; rows: Record<string, unknown>[] };
      const kbs = JSON.parse(body.kbsJson) as { headers: string[]; rows: Record<string, unknown>[] };
      return this.svc.compareBordroMebbisKbs(this.sid(p, q), null, null, mebbis, kbs);
    }
    if (!mebbisF?.buffer?.length || !kbsF?.buffer?.length) {
      throw new BadRequestException('MEBBİS ve KBS Excel dosyaları gerekli');
    }
    return this.svc.compareBordroMebbisKbs(this.sid(p, q), mebbisF.buffer, kbsF.buffer);
  }

  @Post('bordro/tc-audit')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  @UseInterceptors(FileInterceptor('file'))
  async auditBordroTc(
    @CurrentUser() p: CurrentUserPayload,
    @Query('school_id') q: string | undefined,
    @UploadedFile() file?: Express.Multer.File,
    @Body() body?: { headers?: string; rows?: string },
  ) {
    if (body?.rows) {
      const headers = body.headers ? (JSON.parse(body.headers) as string[]) : [];
      const rows = JSON.parse(body.rows) as Record<string, unknown>[];
      return this.svc.auditBordroTc(this.sid(p, q), null, { headers, rows });
    }
    if (!file?.buffer?.length) throw new BadRequestException('Excel gerekli');
    return this.svc.auditBordroTc(this.sid(p, q), file.buffer);
  }

  @Post('bordro/parse-json')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  async parseBordroJson(
    @CurrentUser() p: CurrentUserPayload,
    @Query('school_id') q: string | undefined,
    @Body()
    body: {
      type: 'mebbis_puantaj' | 'ek_ders_bordro' | 'maas_bordro';
      donem: string;
      headers: string[];
      rows: Record<string, unknown>[];
      schoolName?: string;
      footerNote?: string;
      scrapeUrl?: string;
      pageTitle?: string;
    },
  ) {
    if (!body.rows?.length) throw new BadRequestException('Sekmeden tablo verisi alınamadı');
    return this.svc.parseBordroFromScrape(
      this.sid(p, q),
      body.type,
      body.headers ?? [],
      body.rows,
      body.donem ?? '',
      body.schoolName,
      body.footerNote,
      { url: body.scrapeUrl, pageTitle: body.pageTitle },
    );
  }

  @Post('bordro/campaign-json')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  async createBordroCampaignJson(
    @CurrentUser() p: CurrentUserPayload,
    @Query('school_id') q: string | undefined,
    @Body()
    body: {
      type: 'mebbis_puantaj' | 'ek_ders_bordro' | 'maas_bordro';
      title: string;
      donem: string;
      headers: string[];
      rows: Record<string, unknown>[];
      manualPhones?: Record<string, string>;
      schoolName?: string;
      footerNote?: string;
      scrapeUrl?: string;
      pageTitle?: string;
    },
  ) {
    if (!body.rows?.length) throw new BadRequestException('Sekmeden tablo verisi alınamadı');
    return this.svc.createBordroCampaign(
      this.sid(p, q),
      p.userId,
      body.type,
      body.title,
      body.donem,
      null,
      null,
      body.manualPhones ?? {},
      body.schoolName,
      body.footerNote,
      {
        headers: body.headers ?? [],
        rows: body.rows,
        scrapeUrl: body.scrapeUrl,
        pageTitle: body.pageTitle,
      },
    );
  }

  // ── Grup mesaj gönderimi ──────────────────────────────────────────────────

  @Post('campaigns/grup-mesaj')
  @Roles(UserRole.school_admin, UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  @UseInterceptors(FileInterceptor('attachment'))
  async grupMesaj(
    @CurrentUser() p: CurrentUserPayload, @Query('school_id') q: string | undefined,
    @Body() body: { title: string; message: string; groupId: string },
    @UploadedFile() attachment?: Express.Multer.File,
  ) {
    if (!body.groupId) throw new BadRequestException('Grup seçilmedi');
    return this.svc.createSimpleCampaign(this.sid(p, q), p.userId, 'grup_mesaj', body.title, body.message, 'group', undefined, undefined, body.groupId, undefined, attachment?.buffer, attachment?.originalname);
  }

  // ── Kişi Grupları ─────────────────────────────────────────────────────────

  @Get('groups')
  @Roles(UserRole.school_admin, UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  listGroups(@CurrentUser() p: CurrentUserPayload, @Query('school_id') q?: string) {
    return this.svc.listGroups(this.sid(p, q));
  }

  @Post('groups')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  createGroup(@CurrentUser() p: CurrentUserPayload, @Query('school_id') q: string | undefined, @Body() body: { name: string; description?: string }) {
    return this.svc.createGroup(this.sid(p, q), body.name, body.description);
  }

  @Patch('groups/:id')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  updateGroup(@CurrentUser() p: CurrentUserPayload, @Param('id') id: string, @Query('school_id') q: string | undefined, @Body() body: { name?: string; description?: string }) {
    return this.svc.updateGroup(this.sid(p, q), id, body);
  }

  @Delete('groups/:id')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  deleteGroup(@CurrentUser() p: CurrentUserPayload, @Param('id') id: string, @Query('school_id') q?: string) {
    return this.svc.deleteGroup(this.sid(p, q), id);
  }

  @Get('groups/:id/members')
  @Roles(UserRole.school_admin, UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  listMembers(@CurrentUser() p: CurrentUserPayload, @Param('id') id: string, @Query('school_id') q?: string) {
    return this.svc.listGroupMembers(this.sid(p, q), id);
  }

  @Post('groups/:id/members')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  addMember(@CurrentUser() p: CurrentUserPayload, @Param('id') id: string, @Query('school_id') q: string | undefined, @Body() body: { name?: string; phone: string }) {
    return this.svc.addMember(this.sid(p, q), id, body.name ?? null, body.phone);
  }

  @Delete('groups/:groupId/members/:memberId')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  removeMember(@CurrentUser() p: CurrentUserPayload, @Param('groupId') groupId: string, @Param('memberId') memberId: string, @Query('school_id') q?: string) {
    return this.svc.removeMember(this.sid(p, q), groupId, memberId);
  }

  @Post('groups/:id/import-excel')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  @UseInterceptors(FileInterceptor('file'))
  importGroupExcel(@CurrentUser() p: CurrentUserPayload, @Param('id') id: string, @Query('school_id') q: string | undefined, @UploadedFile() file?: Express.Multer.File) {
    if (!file?.buffer?.length) throw new BadRequestException('Excel dosyası gerekli');
    return this.svc.importMembersFromExcel(this.sid(p, q), id, file.buffer);
  }

  // ── PDF preview endpoint ───────────────────────────────────────────────────
  @Get('campaigns/:id/recipient-file/:recipientId')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  async recipientFile(@CurrentUser() p: CurrentUserPayload, @Param('id') _id: string, @Param('recipientId') rid: string, @Query('school_id') q: string | undefined, @Res() res: Response) {
    const sid = this.sid(p, q); void sid;
    const recipients = await this.svc.listRecipients(this.sid(p, q), _id);
    const r = recipients.find((x) => x.id === rid);
    if (!r?.filePath) return res.status(404).send('Dosya bulunamadı');
    const { existsSync, readFileSync } = await import('fs');
    if (!existsSync(r.filePath)) return res.status(404).send('Dosya bulunamadı');
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="dosya.pdf"' });
    res.send(readFileSync(r.filePath));
  }
}
