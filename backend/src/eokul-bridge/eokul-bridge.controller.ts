import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../types/enums';
import { BadRequestException } from '@nestjs/common';
import { EokulBridgeService } from './eokul-bridge.service';
import { KelebekImportDto } from './dto/kelebek-import.dto';
import { ButterflyExamService } from '../butterfly-exam/butterfly-exam.service';
import { MessagingService } from '../messaging/messaging.service';
import { DersDevamsizlikImportDto, GunlukDevamsizlikImportDto } from './dto/devamsizlik-import.dto';
import { DersDagitEokulImportDto } from './dto/ders-dagit-eokul-import.dto';
import { DersDagitService } from '../ders-dagit/ders-dagit.service';
import { DevamsizlikMektupImportDto } from './dto/mektup-import.dto';
import { ToplamDevamsizlikImportDto } from './dto/toplam-devamsizlik-import.dto';
import { VeliRehberImportDto } from './dto/veli-rehber-import.dto';
import { IzinImportDto } from './dto/izin-import.dto';
import { VeliIzinPdfDto } from './dto/veli-izin-pdf.dto';
import { EokulBridgeVeliIzinPdfService } from './eokul-bridge-veli-izin-pdf.service';
import { OgrenciDosyaImportDto } from './dto/ogrenci-dosya-import.dto';
import { EokulBridgeOgrenciDosyaImportService } from './eokul-bridge-ogrenci-dosya-import.service';

@Controller('eokul-bridge/v1')
export class EokulBridgeController {
  constructor(
    private readonly bridge: EokulBridgeService,
    private readonly butterfly: ButterflyExamService,
    private readonly messaging: MessagingService,
    private readonly dersDagit: DersDagitService,
    private readonly veliIzinPdfService: EokulBridgeVeliIzinPdfService,
    private readonly ogrenciDosyaImport: EokulBridgeOgrenciDosyaImportService,
  ) {}

  @Get('bootstrap')
  @UseGuards(JwtAuthGuard)
  getBootstrap() {
    return this.bridge.getBootstrap();
  }

  @Get('extension/version-check')
  versionCheck(@Query('version') version?: string) {
    return this.bridge.checkExtensionVersion(String(version ?? '').trim());
  }

  @Get('extension/feature-enabled')
  featureEnabled() {
    return this.bridge.isFeatureEnabled();
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  status(@Req() req: { user?: { id?: string; school_id?: string | null; role?: string } }) {
    const u = req.user;
    return {
      ok: true,
      extensionEnabled: this.bridge.isFeatureEnabled().enabled,
      minExtensionVersion: this.bridge.getBootstrap().minExtensionVersion,
      portalOrigin: this.bridge.resolvePortalOrigin(),
      user: u
        ? {
            id: u.id,
            school_id: u.school_id ?? null,
            role: u.role ?? null,
          }
        : null,
    };
  }

  @Post('import/kelebek-students')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  importKelebek(
    @CurrentUser() payload: CurrentUserPayload,
    @Body() body: KelebekImportDto,
  ) {
    const schoolId = this.resolveSchoolId(payload, body.school_id);
    this.butterfly.assertSchoolAccess(payload.role, payload.schoolId, schoolId);
    return this.butterfly.importKelebekFromEokulPayload(schoolId, {
      siniflar: body.siniflar,
      create_missing_classes: body.create_missing_classes !== false,
    });
  }

  @Post('import/gunluk-devamsizlik')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin, UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  importGunlukDevamsizlik(
    @CurrentUser() payload: CurrentUserPayload,
    @Body() body: GunlukDevamsizlikImportDto,
  ) {
    const schoolId = this.resolveSchoolId(payload, body.school_id);
    return this.messaging.importDevamsizlikFromEokul(schoolId, payload.userId, 'devamsizlik', body);
  }

  @Post('import/ders-devamsizlik')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin, UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  importDersDevamsizlik(
    @CurrentUser() payload: CurrentUserPayload,
    @Body() body: DersDevamsizlikImportDto,
  ) {
    const schoolId = this.resolveSchoolId(payload, body.school_id);
    return this.messaging.importDevamsizlikFromEokul(schoolId, payload.userId, 'ders_devamsizlik', body);
  }

  @Post('import/toplam-devamsizlik')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin, UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  importToplamDevamsizlik(
    @CurrentUser() payload: CurrentUserPayload,
    @Body() body: ToplamDevamsizlikImportDto,
  ) {
    const schoolId = this.resolveSchoolId(payload, body.school_id);
    return this.messaging.importToplamDevamsizlikFromEokul(schoolId, payload.userId, body);
  }

  @Post('import/devamsizlik-mektup-recipients')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  importDevamsizlikMektupRecipients(
    @CurrentUser() payload: CurrentUserPayload,
    @Body() body: DevamsizlikMektupImportDto,
  ) {
    const schoolId = this.resolveSchoolId(payload, body.school_id);
    return this.messaging.buildDevamsizlikMektupRecipients(schoolId, body.ogrenciler);
  }

  @Post('import/ogrenci-dosya')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  importOgrenciDosya(
    @CurrentUser() payload: CurrentUserPayload,
    @Body() body: OgrenciDosyaImportDto,
  ) {
    const schoolId = this.resolveSchoolId(payload, body.school_id);
    return this.ogrenciDosyaImport.import(schoolId, body);
  }

  @Post('import/veli-rehber')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  importVeliRehber(
    @CurrentUser() payload: CurrentUserPayload,
    @Body() body: VeliRehberImportDto,
  ) {
    const schoolId = this.resolveSchoolId(payload, body.school_id);
    return this.messaging.importVeliRehberFromEokul(schoolId, body.rows);
  }

  @Post('import/izin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin, UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  importIzin(
    @CurrentUser() payload: CurrentUserPayload,
    @Body() body: IzinImportDto,
  ) {
    const schoolId = this.resolveSchoolId(payload, body.school_id);
    return this.messaging.importIzinFromEokul(schoolId, payload.userId, body);
  }

  @Post('import/ders-dagit-eokul/preview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  previewDersDagitEokul(
    @CurrentUser() payload: CurrentUserPayload,
    @Body() body: DersDagitEokulImportDto,
  ) {
    const schoolId = this.resolveSchoolId(payload, body.school_id);
    return this.dersDagit.previewEokulImport(schoolId, {
      file_base64: body.file_base64,
      format: body.format ?? 'auto',
    });
  }

  @Get('veli-push-queue')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  veliPushQueue(
    @CurrentUser() payload: CurrentUserPayload,
    @Query('school_id') schoolIdQ?: string,
    @Query('limit') limit?: string,
  ) {
    const schoolId = this.resolveSchoolId(payload, schoolIdQ);
    const n = Math.min(5000, Math.max(1, parseInt(String(limit || '2000'), 10) || 2000));
    return this.messaging.listVeliPushQueueForEokul(schoolId, n);
  }

  @Get('devamsizlik-campaigns')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin, UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  listDevamsizlikCampaigns(
    @CurrentUser() payload: CurrentUserPayload,
    @Query('school_id') schoolIdQ?: string,
    @Query('limit') limit?: string,
  ) {
    const schoolId = this.resolveSchoolId(payload, schoolIdQ);
    const n = Math.min(100, Math.max(1, parseInt(String(limit || '30'), 10) || 30));
    return this.messaging.listEokulDevamsizlikCampaigns(schoolId, n);
  }

  @Post('ozur/veli-izin-pdf')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin, UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async createVeliIzinPdf(
    @CurrentUser() payload: CurrentUserPayload,
    @Body() body: VeliIzinPdfDto,
    @Res() res: Response,
  ) {
    const schoolId = this.resolveSchoolId(payload, body.school_id);
    const pdf = await this.veliIzinPdfService.generatePdf(schoolId, body);
    const safe = String(body.ogrenci.ad_soyad || 'ogrenci')
      .replace(/[^\w\u00C0-\u024F\s-]+/gu, '')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 80);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safe || 'veli_izin'}_dilekce.pdf"`);
    res.send(pdf);
  }

  @Get('devamsizlik-campaigns/:campaignId/write-payload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin, UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  getDevamsizlikWritePayload(
    @CurrentUser() payload: CurrentUserPayload,
    @Param('campaignId') campaignId: string,
    @Query('school_id') schoolIdQ?: string,
  ) {
    const schoolId = this.resolveSchoolId(payload, schoolIdQ);
    return this.messaging.getEokulDevamsizlikWritePayload(schoolId, campaignId);
  }

  @Post('import/ders-dagit-eokul')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  importDersDagitEokul(
    @CurrentUser() payload: CurrentUserPayload,
    @Body() body: DersDagitEokulImportDto,
  ) {
    const schoolId = this.resolveSchoolId(payload, body.school_id);
    return this.dersDagit.importEokulAssignments(body.studio_id, schoolId, payload.userId, {
      file_base64: body.file_base64,
      format: body.format ?? 'auto',
      replace: !!body.replace,
      auto_elective_groups: body.auto_elective_groups !== false,
    });
  }

  private resolveSchoolId(payload: CurrentUserPayload, q?: string): string {
    if (payload.role === UserRole.superadmin || payload.role === UserRole.moderator) {
      const id = String(q ?? '').trim();
      if (!id) {
        throw new BadRequestException({ code: 'SCHOOL_ID', message: 'superadmin için school_id gerekli.' });
      }
      return id;
    }
    if (!payload.schoolId) {
      throw new BadRequestException({ code: 'NO_SCHOOL', message: 'Okul bağlantısı yok.' });
    }
    return payload.schoolId;
  }
}
