import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { env } from '../config/env';
import { User } from '../users/entities/user.entity';
import { WebauthnCredential } from './entities/webauthn-credential.entity';
import { WebauthnChallenge } from './entities/webauthn-challenge.entity';
import { UserRole, UserStatus } from '../types/enums';

export type AuthPortal = 'teacher' | 'school';

const WRONG_PORTAL_USE_TEACHER_LOGIN = {
  code: 'WRONG_PORTAL_USE_TEACHER_LOGIN' as const,
  message: 'Bu hesap öğretmen girişi ile kullanılır. Öğretmen giriş sayfasına yönlendiriliyorsunuz.',
};
const WRONG_PORTAL_USE_SCHOOL_LOGIN = {
  code: 'WRONG_PORTAL_USE_SCHOOL_LOGIN' as const,
  message: 'Bu hesap okul yöneticisi girişi ile kullanılır. Okul giriş sayfasına yönlendiriliyorsunuz.',
};

@Injectable()
export class WebauthnService {
  private readonly log = new Logger(WebauthnService.name);

  constructor(
    @InjectRepository(WebauthnCredential)
    private readonly credRepo: Repository<WebauthnCredential>,
    @InjectRepository(WebauthnChallenge)
    private readonly challengeRepo: Repository<WebauthnChallenge>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  isConfigured(): boolean {
    return !!this.getRpId();
  }

  private getRpId(): string {
    const explicit = process.env.WEBAUTHN_RP_ID?.trim();
    if (explicit) return explicit;
    try {
      return new URL(env.frontendUrl).hostname;
    } catch {
      return 'localhost';
    }
  }

  private getRpName(): string {
    return process.env.WEBAUTHN_RP_NAME?.trim() || 'Uzaedu Öğretmen';
  }

  private getOrigins(): string[] {
    const extra = process.env.WEBAUTHN_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
    const set = new Set([env.frontendUrl, ...env.corsOrigins, ...extra]);
    return [...set];
  }

  private assertOrigin(origin: string | undefined): string {
    const allowed = this.getOrigins();
    if (!origin || !allowed.includes(origin)) {
      throw new BadRequestException({ code: 'INVALID_ORIGIN', message: 'Geçersiz istek kaynağı.' });
    }
    return origin;
  }

  private teacherRoles(): UserRole[] {
    return [UserRole.teacher, UserRole.superadmin, UserRole.moderator];
  }

  private assertPortal(user: User, portal: AuthPortal): void {
    if (portal === 'school') {
      if (user.role !== UserRole.school_admin) {
        if (user.role === UserRole.teacher) throw new UnauthorizedException(WRONG_PORTAL_USE_TEACHER_LOGIN);
        throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Oturum açılamadı.' });
      }
      return;
    }
    if (!this.teacherRoles().includes(user.role as UserRole)) {
      if (user.role === UserRole.school_admin) throw new UnauthorizedException(WRONG_PORTAL_USE_SCHOOL_LOGIN);
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Oturum açılamadı.' });
    }
  }

  private async storeChallenge(userId: string, challenge: string): Promise<void> {
    const expires_at = new Date(Date.now() + 5 * 60 * 1000);
    await this.challengeRepo.upsert({ user_id: userId, challenge, expires_at }, { conflictPaths: ['user_id'] });
    await this.challengeRepo.delete({ expires_at: LessThan(new Date()) });
  }

  private async takeChallenge(userId: string): Promise<string> {
    const row = await this.challengeRepo.findOne({ where: { user_id: userId } });
    await this.challengeRepo.delete({ user_id: userId });
    if (!row || row.expires_at < new Date()) {
      throw new BadRequestException({ code: 'CHALLENGE_EXPIRED', message: 'Doğrulama süresi doldu. Tekrar deneyin.' });
    }
    return row.challenge;
  }

  async hasCredentials(email: string, portal: AuthPortal): Promise<{ available: boolean; count: number }> {
    if (!this.isConfigured()) return { available: false, count: 0 };
    const user = await this.findActiveUser(email);
    if (!user || user.passkeyLoginEnabled === false) return { available: false, count: 0 };
    try {
      this.assertPortal(user, portal);
    } catch {
      return { available: false, count: 0 };
    }
    const count = await this.credRepo.count({ where: { user_id: user.id } });
    return { available: count > 0, count };
  }

  async listCredentials(userId: string) {
    const rows = await this.credRepo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      device_type: r.device_type,
      backed_up: r.backed_up,
      created_at: r.created_at,
      last_used_at: r.last_used_at,
    }));
  }

  async deleteCredential(userId: string, credId: string): Promise<void> {
    const row = await this.credRepo.findOne({ where: { id: credId, user_id: userId } });
    if (!row) throw new BadRequestException({ code: 'NOT_FOUND', message: 'Kayıt bulunamadı.' });
    await this.credRepo.remove(row);
  }

  async renameCredential(userId: string, credId: string, name: string): Promise<{ ok: true }> {
    const trimmed = name.trim().slice(0, 120);
    if (!trimmed) {
      throw new BadRequestException({ code: 'INVALID_INPUT', message: 'Cihaz adı gerekli.' });
    }
    const row = await this.credRepo.findOne({ where: { id: credId, user_id: userId } });
    if (!row) throw new BadRequestException({ code: 'NOT_FOUND', message: 'Kayıt bulunamadı.' });
    row.name = trimmed;
    await this.credRepo.save(row);
    return { ok: true };
  }

  async registrationOptions(userId: string, origin: string) {
    this.assertOrigin(origin);
    const user = await this.userRepo.findOne({ where: { id: userId, status: UserStatus.active } });
    if (!user) throw new UnauthorizedException();

    const existing = await this.credRepo.find({ where: { user_id: userId } });
    const options = await generateRegistrationOptions({
      rpName: this.getRpName(),
      rpID: this.getRpId(),
      userName: user.email,
      userDisplayName: user.display_name?.trim() || user.email,
      userID: new TextEncoder().encode(user.id),
      attestationType: 'none',
      excludeCredentials: existing.map((c) => ({
        id: c.credential_id,
        transports: (c.transports ?? []) as AuthenticatorTransportFuture[],
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'required',
        authenticatorAttachment: 'platform',
      },
    });

    await this.storeChallenge(userId, options.challenge);
    return options;
  }

  async registrationVerify(
    userId: string,
    origin: string,
    response: RegistrationResponseJSON,
    name?: string,
  ): Promise<{ ok: true; already_exists?: boolean }> {
    this.assertOrigin(origin);
    const expectedChallenge = await this.takeChallenge(userId);
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: this.getRpId(),
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new BadRequestException({ code: 'VERIFY_FAILED', message: 'Biyometrik kayıt doğrulanamadı.' });
    }

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
    const trimmedName = name?.trim()?.slice(0, 120) || null;

    const existing = await this.credRepo.findOne({ where: { credential_id: credential.id } });
    if (existing) {
      if (existing.user_id !== userId) {
        throw new BadRequestException({
          code: 'CREDENTIAL_IN_USE',
          message: 'Bu cihaz kimliği başka bir hesaba bağlı.',
        });
      }
      if (trimmedName) existing.name = trimmedName;
      existing.last_used_at = new Date();
      await this.credRepo.save(existing);
      return { ok: true, already_exists: true };
    }

    const row = this.credRepo.create({
      user_id: userId,
      credential_id: credential.id,
      public_key: Buffer.from(credential.publicKey),
      counter: String(credential.counter),
      device_type: credentialDeviceType,
      backed_up: credentialBackedUp,
      transports: credential.transports ?? null,
      name: trimmedName || this.defaultDeviceName(),
    });
    await this.credRepo.save(row);
    return { ok: true };
  }

  async loginOptions(email: string, portal: AuthPortal, origin: string) {
    this.assertOrigin(origin);
    const user = await this.findActiveUser(email);
    if (!user) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Kayıtlı biyometrik giriş bulunamadı.' });
    }
    this.assertPortal(user, portal);
    if (user.passkeyLoginEnabled === false) {
      throw new BadRequestException({
        code: 'PASSKEY_DISABLED',
        message: 'Biyometrik giriş hesabınızda kapalı. Profil → Güvenlik bölümünden açın.',
      });
    }

    const creds = await this.credRepo.find({ where: { user_id: user.id } });
    if (creds.length === 0) {
      throw new BadRequestException({
        code: 'NO_PASSKEY',
        message: 'Bu hesapta biyometrik giriş tanımlı değil. Önce şifre ile giriş yapıp Profil → Biyometrik ekleyin.',
      });
    }

    const options = await generateAuthenticationOptions({
      rpID: this.getRpId(),
      allowCredentials: creds.map((c) => ({
        id: c.credential_id,
        transports: (c.transports ?? []) as AuthenticatorTransportFuture[],
      })),
      userVerification: 'required',
    });

    await this.storeChallenge(user.id, options.challenge);
    return options;
  }

  async loginVerify(
    email: string,
    portal: AuthPortal,
    origin: string,
    response: AuthenticationResponseJSON,
  ): Promise<{ token: string; user: User }> {
    this.assertOrigin(origin);
    const user = await this.findActiveUser(email);
    if (!user) throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Oturum açılamadı.' });
    this.assertPortal(user, portal);
    if (user.passkeyLoginEnabled === false) {
      throw new BadRequestException({
        code: 'PASSKEY_DISABLED',
        message: 'Biyometrik giriş hesabınızda kapalı.',
      });
    }

    const expectedChallenge = await this.takeChallenge(user.id);
    const cred = await this.credRepo.findOne({
      where: { user_id: user.id, credential_id: response.id },
    });
    if (!cred) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Geçersiz kimlik bilgisi.' });
    }

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: this.getRpId(),
      requireUserVerification: true,
      credential: {
        id: cred.credential_id,
        publicKey: new Uint8Array(cred.public_key),
        counter: Number(cred.counter),
        transports: (cred.transports ?? []) as AuthenticatorTransportFuture[],
      },
    });

    if (!verification.verified) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Biyometrik doğrulama başarısız.' });
    }

    cred.counter = String(verification.authenticationInfo.newCounter);
    cred.last_used_at = new Date();
    await this.credRepo.save(cred);

    const fresh = await this.userRepo.findOne({ where: { id: user.id }, relations: ['school'] });
    return { token: user.id, user: fresh ?? user };
  }

  private async findActiveUser(email: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: { email: email.trim().toLowerCase(), status: UserStatus.active },
      relations: ['school'],
    });
  }

  private defaultDeviceName(): string {
    return 'Bu cihaz';
  }
}
