import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { School } from '../schools/entities/school.entity';
import {
  codesMatch,
  generateOkulKoprusuCode,
  isLicenseRecordValid,
  isOkulKoprusuModuleEnabled,
  maskOkulKoprusuCode,
  OKUL_KOPRUSU_MODULE,
  type OkulKoprusuLicense,
  type OkulKoprusuTier,
} from './okul-koprusu-license';

export type SchoolAccessSnapshot = {
  ok: boolean;
  moduleKey: typeof OKUL_KOPRUSU_MODULE;
  moduleEnabled: boolean;
  tier: OkulKoprusuTier | null;
  licenseActive: boolean;
  requiresCode: boolean;
  canUseBridge: boolean;
  codeMasked: string | null;
  marketHref: string;
  message?: string;
  school: {
    id: string;
    name: string;
    city: string | null;
    district: string | null;
    institutionCode: string | null;
    status: string;
  } | null;
};

@Injectable()
export class EokulBridgeSchoolAccessService {
  constructor(
    @InjectRepository(School)
    private readonly schoolRepo: Repository<School>,
  ) {}

  private licenseOf(school: School): OkulKoprusuLicense | null {
    const raw = school.okulKoprusuLicense;
    if (!raw || typeof raw !== 'object') return null;
    return raw as OkulKoprusuLicense;
  }

  private buildSnapshot(school: School, opts?: { codeVerified?: boolean }): SchoolAccessSnapshot {
    const moduleEnabled = isOkulKoprusuModuleEnabled(school.enabled_modules);
    const lic = this.licenseOf(school);
    const licenseActive = isLicenseRecordValid(lic);
    const tier = lic?.tier ?? null;
    const codeVerified = !!opts?.codeVerified;

    let requiresCode = false;
    let canUseBridge = false;
    let message: string | undefined;

    if (!moduleEnabled) {
      message = 'Okul Köprüsü modülü Market üzerinden okulunuza açılmalıdır.';
    } else {
      canUseBridge = true;
      requiresCode = false;
      if (lic && !licenseActive) {
        message = 'Kayıtlı aktivasyon kodu süresi dolmuş; Market modülü açık olduğu sürece köprü kullanılabilir.';
      } else if (!lic) {
        message = 'Market modülü aktif. İsteğe bağlı: panelden okul aktivasyon kodu oluşturabilirsiniz.';
      }
    }

    return {
      ok: true,
      moduleKey: OKUL_KOPRUSU_MODULE,
      moduleEnabled,
      tier,
      licenseActive,
      requiresCode,
      canUseBridge,
      codeMasked: lic?.code ? maskOkulKoprusuCode(lic.code) : null,
      marketHref: '/market?module=okul_koprusu',
      message,
      school: {
        id: school.id,
        name: school.name,
        city: school.city,
        district: school.district,
        institutionCode: school.institutionCode,
        status: school.status,
      },
    };
  }

  async getAccessForSchoolId(schoolId: string, codeVerified = false): Promise<SchoolAccessSnapshot> {
    const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
    if (!school) throw new NotFoundException('Okul bulunamadı');
    return this.buildSnapshot(school, { codeVerified });
  }

  async verifyCode(schoolId: string, code: string): Promise<SchoolAccessSnapshot & { verified: boolean }> {
    const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
    if (!school) throw new NotFoundException('Okul bulunamadı');
    const lic = this.licenseOf(school);
    if (!lic?.code) {
      throw new BadRequestException('Bu okul için henüz aktivasyon kodu tanımlanmamış.');
    }
    if (!isLicenseRecordValid(lic)) {
      throw new BadRequestException('Aktivasyon kodu geçersiz veya süresi dolmuş.');
    }
    if (!codesMatch(lic.code, code)) {
      throw new BadRequestException('Aktivasyon kodu hatalı.');
    }
    const snap = this.buildSnapshot(school, { codeVerified: true });
    return { ...snap, verified: true };
  }

  async getLicenseAdminView(schoolId: string) {
    const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
    if (!school) throw new NotFoundException('Okul bulunamadı');
    const lic = this.licenseOf(school);
    const snap = this.buildSnapshot(school);
    return {
      ...snap,
      code: lic?.code ?? null,
      license: lic,
    };
  }

  async regenerateLicense(
    schoolId: string,
    tier: OkulKoprusuTier = 'paid',
  ): Promise<{ code: string; license: OkulKoprusuLicense } & SchoolAccessSnapshot> {
    const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
    if (!school) throw new NotFoundException('Okul bulunamadı');
    const license: OkulKoprusuLicense = {
      code: generateOkulKoprusuCode(),
      tier,
      active: true,
      createdAt: new Date().toISOString(),
      expiresAt: null,
    };
    school.okulKoprusuLicense = license;
    await this.schoolRepo.save(school);
    const snap = this.buildSnapshot(school);
    return { ...snap, code: license.code, license };
  }

  async patchLicense(
    schoolId: string,
    patch: { tier?: OkulKoprusuTier; active?: boolean },
  ): Promise<SchoolAccessSnapshot & { code: string | null; license: OkulKoprusuLicense | null }> {
    const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
    if (!school) throw new NotFoundException('Okul bulunamadı');
    let lic = this.licenseOf(school);
    if (!lic) {
      throw new BadRequestException('Önce aktivasyon kodu oluşturun.');
    }
    if (patch.tier) lic = { ...lic, tier: patch.tier };
    if (patch.active !== undefined) lic = { ...lic, active: patch.active };
    school.okulKoprusuLicense = lic;
    await this.schoolRepo.save(school);
    const snap = this.buildSnapshot(school);
    return { ...snap, code: lic.code, license: lic };
  }

  assertBridgeAllowed(snap: SchoolAccessSnapshot) {
    if (!snap.canUseBridge) {
      throw new BadRequestException(snap.message || 'Okul köprüsü kullanılamıyor.');
    }
  }
}
