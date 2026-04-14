import {
  BadRequestException, Body, Controller, Delete, Get, Param,
  Patch, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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
import {
  SaveSettingsDto, TestConnectionDto, CreateManualCampaignDto,
  CreateExcelCampaignDto, CreatePdfSplitCampaignDto,
} from './dto/messaging.dto';

@Controller('messaging')
@UseGuards(JwtAuthGuard, RolesGuard, RequireSchoolModuleGuard, RequireModuleActivationGuard)
@RequireSchoolModule('messaging')
export class MessagingController {
  constructor(private readonly svc: MessagingService) {}

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

  // ── Kampanyalar listesi ────────────────────────────────────────────────────

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
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  execute(@CurrentUser() p: CurrentUserPayload, @Param('id') id: string, @Query('school_id') q?: string) {
    return this.svc.executeCampaign(this.sid(p, q), id);
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
    return this.svc.createTopluMesajCampaign(this.sid(p, q), p.userId, body.title, body.template ?? '{AD}, iyi günler.', file.buffer, file.originalname);
  }

  // ── Ek Ders ───────────────────────────────────────────────────────────────

  @Post('campaigns/ek-ders/excel')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  @UseInterceptors(FileInterceptor('file'))
  ekDers(@CurrentUser() p: CurrentUserPayload, @Query('school_id') q: string | undefined, @Body() body: CreateExcelCampaignDto, @UploadedFile() file: Express.Multer.File | undefined) {
    if (!file?.buffer?.length) throw new BadRequestException('Excel dosyası gerekli');
    const tpl = body.template ?? 'Sayın {AD}, {AY} ayına ait ek ders bilginiz: Ders {SAAT} saat, Tutar {TUTAR} TL. — OgretmenPro';
    return this.svc.createEkDersCampaign(this.sid(p, q), p.userId, body.title, tpl, file.buffer, file.originalname);
  }

  // ── Maaş ──────────────────────────────────────────────────────────────────

  @Post('campaigns/maas/excel')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  @UseInterceptors(FileInterceptor('file'))
  maas(@CurrentUser() p: CurrentUserPayload, @Query('school_id') q: string | undefined, @Body() body: CreateExcelCampaignDto, @UploadedFile() file: Express.Multer.File | undefined) {
    if (!file?.buffer?.length) throw new BadRequestException('Excel dosyası gerekli');
    const tpl = body.template ?? 'Sayın {AD}, {AY} ayı maaş bilginiz: Brüt {BRUT} TL / Net {NET} TL. — OgretmenPro';
    return this.svc.createMaasCampaign(this.sid(p, q), p.userId, body.title, tpl, file.buffer, file.originalname);
  }

  // ── Günlük Devamsızlık ────────────────────────────────────────────────────

  @Post('campaigns/devamsizlik/excel')
  @Roles(UserRole.school_admin, UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  @UseInterceptors(FileInterceptor('file'))
  devamsizlik(@CurrentUser() p: CurrentUserPayload, @Query('school_id') q: string | undefined, @Body() body: CreateExcelCampaignDto, @UploadedFile() file: Express.Multer.File | undefined) {
    if (!file?.buffer?.length) throw new BadRequestException('Excel dosyası gerekli');
    const tpl = body.template ?? `📣 Sayın {AD},\n\n- Öğr. Adı Soyadı: {OGRENCI}\n- Sınıfı: {SINIF}\n- Tarih: {TARIH}\n- Gün: {GUN}\n- Türü: {TUR} olarak devamsızlık yapmıştır.\n\n📚 {OKUL}`;
    return this.svc.createDevamsizlikCampaign(this.sid(p, q), p.userId, body.title, tpl, body.tarih ?? new Date().toLocaleDateString('tr-TR'), file.buffer, file.originalname);
  }

  // ── Devamsızlık Mektubu / Karne (PDF split) ──────────────────────────────

  @Post('campaigns/devamsizlik-mektup/pdf')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  @UseInterceptors(FileInterceptor('file'))
  devamsizlikMektup(@CurrentUser() p: CurrentUserPayload, @Query('school_id') q: string | undefined, @Body() body: CreatePdfSplitCampaignDto, @UploadedFile() file: Express.Multer.File | undefined) {
    if (!file?.buffer?.length) throw new BadRequestException('PDF dosyası gerekli');
    const tpl = body.template ?? `📣 Sayın {AD},\n\n- Öğr. Adı Soyadı: {OGRENCI}\n- Sınıfı: {SINIF}\n\n- Açıklama: Öğrencimize ait devamsızlık mektubu ektedir. İncelemenizi rica ederiz.\n\n📚 {OKUL}`;
    return this.svc.createPdfSplitCampaign(this.sid(p, q), p.userId, 'devamsizlik_mektup', body.title, tpl, file.buffer, file.originalname, body.recipients, body.pagesPerStudent);
  }

  @Post('campaigns/karne/pdf')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  @UseInterceptors(FileInterceptor('file'))
  karne(@CurrentUser() p: CurrentUserPayload, @Query('school_id') q: string | undefined, @Body() body: CreatePdfSplitCampaignDto, @UploadedFile() file: Express.Multer.File | undefined) {
    if (!file?.buffer?.length) throw new BadRequestException('PDF dosyası gerekli');
    const tpl = body.template ?? `📣 Sayın {AD},\n\n- Öğr. Adı Soyadı: {OGRENCI}\n- Sınıfı: {SINIF}\n\n- Açıklama: Öğrencimize ait karnesi ekte sunulmuştur. İyi tatiller dileriz.\n\n📚 {OKUL}`;
    return this.svc.createPdfSplitCampaign(this.sid(p, q), p.userId, 'karne', body.title, tpl, file.buffer, file.originalname, body.recipients, body.pagesPerStudent);
  }

  @Post('campaigns/ara-karne/pdf')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  @UseInterceptors(FileInterceptor('file'))
  araKarne(@CurrentUser() p: CurrentUserPayload, @Query('school_id') q: string | undefined, @Body() body: CreatePdfSplitCampaignDto, @UploadedFile() file: Express.Multer.File | undefined) {
    if (!file?.buffer?.length) throw new BadRequestException('PDF dosyası gerekli');
    const tpl = body.template ?? `📣 Sayın {AD},\n\n- Öğr. Adı Soyadı: {OGRENCI}\n- Sınıfı: {SINIF}\n\n- Açıklama: Öğrencimize ait Ara Karne belgesi tarafınıza iletilmiştir. Belgede ders notları ve devamsızlık bilgileri yer almaktadır.\n\n📚 {OKUL}`;
    return this.svc.createPdfSplitCampaign(this.sid(p, q), p.userId, 'ara_karne', body.title, tpl, file.buffer, file.originalname, body.recipients, body.pagesPerStudent);
  }

  // ── Ders Bazlı Devamsızlık ─────────────────────────────────────────────────

  @Post('campaigns/ders-devamsizlik/excel')
  @Roles(UserRole.school_admin, UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  @UseInterceptors(FileInterceptor('file'))
  dersDevamsizlik(@CurrentUser() p: CurrentUserPayload, @Query('school_id') q: string | undefined, @Body() body: CreateExcelCampaignDto, @UploadedFile() file: Express.Multer.File | undefined) {
    if (!file?.buffer?.length) throw new BadRequestException('Excel dosyası gerekli');
    const tpl = body.template ?? `📣 Sayın {AD},\n\n- Öğr. Adı Soyadı: {OGRENCI}\n- Sınıfı: {SINIF}\n- Tarih: {TARIH}\n\n- Açıklama: Öğrencimiz, belirtilen tarihte {DERSLER_INLINE} ders saatlerinde devamsızlık yapmıştır.\n\n📚 {OKUL}`;
    return this.svc.createDersDevamsizlikCampaign(this.sid(p, q), p.userId, body.title, tpl, body.tarih ?? new Date().toLocaleDateString('tr-TR'), file.buffer, file.originalname);
  }

  // ── Evci / Çarşı İzin ─────────────────────────────────────────────────────

  @Post('campaigns/izin/excel')
  @Roles(UserRole.school_admin, UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  @UseInterceptors(FileInterceptor('file'))
  izin(@CurrentUser() p: CurrentUserPayload, @Query('school_id') q: string | undefined, @Body() body: CreateExcelCampaignDto, @UploadedFile() file: Express.Multer.File | undefined) {
    if (!file?.buffer?.length) throw new BadRequestException('Excel dosyası gerekli');
    const tpl = body.template ?? `📣 Sayın {AD},\n\n- Öğr. Adı Soyadı: {OGRENCI}\n- Sınıfı: {SINIF}\n\nİzin Türü: {TUR}\nİzinli Çıkış: {CIKIS}\nPansiyona Dönüş: {DONUS}\n\nAçıklama: Öğrencimize ait evci-çarşı izin bilgileri tarafınıza sunulmuştur.\n\n📚 {OKUL}`;
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
