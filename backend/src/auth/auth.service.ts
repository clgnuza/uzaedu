import {
  Injectable,
  Logger,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as admin from 'firebase-admin';
import { randomBytes } from 'crypto';
import { User } from '../users/entities/user.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { UserRole, UserStatus, TeacherSchoolMembershipStatus, SchoolStatus } from '../types/enums';
import { SchoolsService } from '../schools/schools.service';
import { env } from '../config/env';
import { EmailService } from './services/email.service';
import { TeacherInviteService } from '../teacher-invite/teacher-invite.service';
import { MailService } from '../mail/mail.service';
import { DEMO_CREDENTIALS } from '../seed/demo-credentials';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(PasswordResetToken)
    private readonly tokenRepo: Repository<PasswordResetToken>,
    private readonly emailService: EmailService,
    private readonly schoolsService: SchoolsService,
    private readonly teacherInvites: TeacherInviteService,
    private readonly mailService: MailService,
  ) {}

  /**
   * E-posta ve şifre ile giriş (yerel/demo). Sadece password_hash set edilmiş kullanıcılar.
   * Başarılı ise token = user.id (Bearer ile kullanılır).
   */
  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    const user = await this.userRepo.findOne({
      where: { email: email.trim().toLowerCase(), status: UserStatus.active },
      relations: ['school'],
    });
    if (!user?.passwordHash) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'E-posta veya şifre hatalı.' });
    }
    const bcryptOk = await bcrypt.compare(password, user.passwordHash);
    const localDemoOk = !bcryptOk && this.matchesLocalDemoCredential(email, password);
    if (!bcryptOk && !localDemoOk) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'E-posta veya şifre hatalı.' });
    }
    if (localDemoOk) {
      user.passwordHash = await bcrypt.hash(password, 10);
      await this.userRepo.save(user);
    }
    if (
      user.role === UserRole.teacher &&
      user.school_id &&
      user.teacherSchoolMembership === TeacherSchoolMembershipStatus.pending
    ) {
      throw new ForbiddenException({
        code: 'TEACHER_PASSWORD_LOGIN_PENDING_SCHOOL_APPROVAL',
        message:
          'Okul onayı tamamlanana kadar e-posta ile giriş kullanılamaz. Google, Apple veya telefon ile giriş yapın.',
      });
    }
    return { token: user.id, user };
  }

  /** Yerelde DB hash eski kalsa bile `demo-credentials` ile giriş; hash güncellenir. */
  private matchesLocalDemoCredential(email: string, password: string): boolean {
    if (!['local', 'development'].includes(env.nodeEnv)) return false;
    const e = email.trim().toLowerCase();
    for (const k of ['teacher', 'school_admin', 'superadmin'] as const) {
      const c = DEMO_CREDENTIALS[k];
      if (c.email === e && c.password === password) return true;
    }
    return false;
  }

  /** Denenen e-postaya ait kullanıcının school_id'si (audit için; başarısız girişte kullanılır) */
  async getSchoolIdForAudit(email: string): Promise<string | null> {
    const user = await this.userRepo.findOne({
      where: { email: email.trim().toLowerCase() },
      select: ['school_id'],
    });
    return user?.school_id ?? null;
  }

  async validateFirebaseUid(firebaseUid: string): Promise<User | null> {
    const user = await this.userRepo.findOne({
      where: { firebaseUid, status: UserStatus.active },
      relations: ['school'],
    });
    return user ?? null;
  }

  async validateUserId(userId: string): Promise<User | null> {
    const user = await this.userRepo.findOne({
      where: { id: userId, status: UserStatus.active },
      relations: ['school'],
    });
    return user ?? null;
  }

  /** Yerel geliştirme: JWT_SECRET ile imzalı token'da sub = user.id kabul edilir */
  isLocalJwtEnabled(): boolean {
    return !!env.jwt.secret && env.nodeEnv === 'local' && !env.firebase.projectId;
  }

  /** Kayıt: e-posta ile kullanıcı oluşturur (rol: teacher, şifre hash'lenir). */
  async register(
    email: string,
    password: string,
    displayName?: string,
    schoolId?: string | null,
    inviteCode?: string | null,
  ): Promise<{ token: string; user: User }> {
    const normalized = email.trim().toLowerCase();
    const existing = await this.userRepo.findOne({ where: { email: normalized } });
    if (existing) {
      throw new ConflictException({ code: 'EMAIL_EXISTS', message: 'Bu e-posta adresi zaten kayıtlı.' });
    }
    let school_id: string | null = null;
    let membership = TeacherSchoolMembershipStatus.none;
    const sid = schoolId?.trim();
    if (sid) {
      const school = await this.schoolsService.findById(sid);
      if (school.status !== SchoolStatus.aktif) {
        throw new BadRequestException({
          code: 'SCHOOL_NOT_ACTIVE',
          message: 'Seçilen okul kayıt için uygun değil (aktif olmalı).',
        });
      }
      school_id = school.id;
      membership = TeacherSchoolMembershipStatus.pending;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const joinToken = school_id ? randomBytes(32).toString('hex') : null;
    const joinExp = school_id ? new Date(Date.now() + 48 * 3600 * 1000) : null;
    const user = this.userRepo.create({
      email: normalized,
      display_name: displayName?.trim() || null,
      role: UserRole.teacher,
      school_id,
      teacherSchoolMembership: membership,
      teacherPublicNameMasked: true,
      status: UserStatus.active,
      passwordHash,
      firebaseUid: null,
      schoolJoinEmailToken: joinToken,
      schoolJoinEmailTokenExpiresAt: joinExp,
      schoolJoinEmailVerifiedAt: school_id ? null : null,
    });
    const saved = await this.userRepo.save(user);
    if (inviteCode?.trim()) {
      try {
        await this.teacherInvites.redeemAfterRegistration(saved.id, inviteCode);
      } catch (e) {
        await this.userRepo.delete(saved.id);
        throw e;
      }
    }
    const withSchool = await this.userRepo.findOne({ where: { id: saved.id }, relations: ['school'] });
    const u = withSchool ?? saved;
    if (school_id && u.school && joinToken) {
      const greet = u.display_name?.trim() || u.email.split('@')[0] || 'Merhaba';
      void this.sendSchoolJoinVerifyMail(u, u.school.name, greet, joinToken).catch(() => {});
    }
    return { token: saved.id, user: u };
  }

  /** Public: e-postadaki doğrulama bağlantısı (token tek kullanımlık). */
  async verifySchoolJoinEmail(tokenRaw: string): Promise<{ ok: boolean; already_verified?: boolean }> {
    const token = tokenRaw?.trim();
    if (!token || token.length < 32) {
      throw new BadRequestException({ code: 'INVALID_TOKEN', message: 'Geçersiz doğrulama bağlantısı.' });
    }
    const user = await this.userRepo.findOne({
      where: { schoolJoinEmailToken: token },
      relations: ['school'],
    });
    if (!user) {
      throw new BadRequestException({ code: 'INVALID_TOKEN', message: 'Doğrulama bağlantısı geçersiz veya kullanılmış.' });
    }
    if (user.schoolJoinEmailVerifiedAt) {
      return { ok: true, already_verified: true };
    }
    if (user.schoolJoinEmailTokenExpiresAt && user.schoolJoinEmailTokenExpiresAt < new Date()) {
      throw new BadRequestException({
        code: 'TOKEN_EXPIRED',
        message: 'Doğrulama süresi dolmuş. Giriş yapıp profilden yeniden bağlantı isteyin.',
      });
    }
    user.schoolJoinEmailVerifiedAt = new Date();
    user.schoolJoinEmailToken = null;
    user.schoolJoinEmailTokenExpiresAt = null;
    await this.userRepo.save(user);
    return { ok: true };
  }

  private async sendSchoolJoinVerifyMail(
    u: User,
    schoolName: string,
    greet: string,
    token: string,
  ): Promise<void> {
    const base = await this.mailService.resolveAppBaseUrl();
    const verifyUrl = `${base}/verify-school-email?token=${encodeURIComponent(token)}`;
    await this.mailService.sendSchoolJoinVerifyEmail(u.email, {
      schoolName,
      recipientName: greet,
      verifyUrl,
    });
  }

  /** Sosyal giriş (Google/Apple/Telefon) ile gelen öğretmenin e-postasını otomatik doğrula ve kaydet */
  private async autoVerifyEmailIfNeeded(user: User): Promise<void> {
    if (
      user.role === UserRole.teacher &&
      user.school_id &&
      user.teacherSchoolMembership === TeacherSchoolMembershipStatus.pending &&
      !user.schoolJoinEmailVerifiedAt
    ) {
      user.schoolJoinEmailVerifiedAt = new Date();
      user.schoolJoinEmailToken = null;
      user.schoolJoinEmailTokenExpiresAt = null;
      await this.userRepo.save(user);
    }
  }

  /** Şifre sıfırlama: token oluştur, e-posta gönder (SMTP yoksa log). */
  async forgotPassword(email: string): Promise<{ ok: boolean; message: string }> {
    const normalized = email.trim().toLowerCase();
    const user = await this.userRepo.findOne({ where: { email: normalized } });
    if (!user) {
      return { ok: true, message: 'E-posta adresiniz kayıtlıysa şifre sıfırlama bağlantısı gönderildi.' };
    }
    if (!user.passwordHash) {
      return { ok: true, message: 'Bu hesap sosyal giriş (Google/Apple/Telefon) ile oluşturulmuş; şifre sıfırlama uygulanamaz.' };
    }
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await this.tokenRepo.delete({ userId: user.id });
    const record = this.tokenRepo.create({ userId: user.id, token, expiresAt });
    await this.tokenRepo.save(record);
    const resetUrl = `${env.frontendUrl}/reset-password?token=${token}`;
    await this.emailService.sendPasswordResetEmail(user.email, resetUrl);
    return { ok: true, message: 'E-posta adresinize şifre sıfırlama bağlantısı gönderildi.' };
  }

  /** Token ile şifre sıfırlama. */
  async resetPassword(token: string, newPassword: string): Promise<{ ok: boolean }> {
    const normalized = token.trim();
    if (!normalized || newPassword.length < 6) {
      throw new BadRequestException({ code: 'INVALID_INPUT', message: 'Geçersiz token veya şifre.' });
    }
    const record = await this.tokenRepo.findOne({
      where: { token: normalized },
      relations: ['user'],
    });
    if (!record || record.expiresAt < new Date()) {
      throw new BadRequestException({
        code: 'INVALID_OR_EXPIRED_TOKEN',
        message: 'Şifre sıfırlama bağlantısı geçersiz veya süresi dolmuş. Lütfen tekrar talep edin.',
      });
    }
    const user = record.user;
    const passwordHash = await bcrypt.hash(newPassword, 10);
    user.passwordHash = passwordHash;
    await this.userRepo.save(user);
    await this.tokenRepo.delete({ id: record.id });
    return { ok: true };
  }

  /** Firebase ID token doğrula; kullanıcı yoksa e-posta ile bul veya oluştur. Oturum token’ı user.id (UUID). */
  async exchangeFirebaseToken(idToken: string): Promise<{ token: string; user: User }> {
    let app: admin.app.App | null = null;
    try {
      app = admin.app();
    } catch {
      // Firebase yok
    }
    if (!app) {
      throw new BadRequestException({
        code: 'FIREBASE_NOT_CONFIGURED',
        message: 'Firebase Admin yapılandırması eksik. backend/.env içindeki Firebase servis hesabını kontrol edin.',
      });
    }
    let decoded: admin.auth.DecodedIdToken;
    try {
      decoded = await app.auth().verifyIdToken(idToken);
    } catch (e: unknown) {
      const fe = e as { code?: string; message?: string };
      const firebaseError = typeof fe?.code === 'string' ? fe.code : 'unknown';
      this.logger.warn(`verifyIdToken: ${firebaseError} ${fe?.message ?? ''}`);
      throw new BadRequestException({
        code: 'FIREBASE_TOKEN_INVALID',
        message:
          'Firebase jetonu doğrulanamadı. Servis hesabı JSON’daki project_id = backend FIREBASE_PROJECT_ID = web NEXT_PUBLIC_FIREBASE_PROJECT_ID olmalı. Anahtarda \\n kullanın.',
        details: { firebaseError },
      });
    }
    const uid = decoded.uid;
    const email = (decoded.email as string)?.trim().toLowerCase() || null;
    const displayName = (decoded.name as string)?.trim() || null;
    const phoneE164 = (decoded.phone_number as string)?.trim() || null;

    let user = await this.userRepo.findOne({ where: { firebaseUid: uid }, relations: ['school'] });
    if (user) {
      await this.autoVerifyEmailIfNeeded(user);
      return { token: user.id, user };
    }
    if (email) {
      user = await this.userRepo.findOne({ where: { email }, relations: ['school'] });
      if (user) {
        user.firebaseUid = uid;
        if (displayName && !user.display_name) user.display_name = displayName;
        if (phoneE164 && !user.teacherPhone) user.teacherPhone = phoneE164;
        await this.autoVerifyEmailIfNeeded(user);
        await this.userRepo.save(user);
        return { token: user.id, user };
      }
    }
    /** Sadece telefon ile Firebase hesabı: token’da e-posta yok; mevcut kaydı telefonla eşle veya sentetik e-posta ile öğretmen oluştur */
    if (!email && phoneE164) {
      user = await this.userRepo.findOne({
        where: { teacherPhone: phoneE164 },
        relations: ['school'],
      });
      if (user) {
        user.firebaseUid = uid;
        await this.autoVerifyEmailIfNeeded(user);
        await this.userRepo.save(user);
        return { token: user.id, user };
      }
      const localSafe = uid.replace(/[^a-zA-Z0-9._-]/g, '_');
      const syntheticEmail = `${localSafe}@phone.ogretmenpro.local`;
      const newPhoneUser = this.userRepo.create({
        email: syntheticEmail,
        display_name: displayName || null,
        role: UserRole.teacher,
        school_id: null,
        teacherSchoolMembership: TeacherSchoolMembershipStatus.none,
        teacherPublicNameMasked: true,
        status: UserStatus.active,
        passwordHash: null,
        firebaseUid: uid,
        teacherPhone: phoneE164,
      });
      const savedPhone = await this.userRepo.save(newPhoneUser);
      return { token: savedPhone.id, user: savedPhone };
    }
    if (!email) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Hesap bilgisi alınamadı (e-posta veya telefon).',
      });
    }
    const newUser = this.userRepo.create({
      email,
      display_name: displayName || null,
      role: UserRole.teacher,
      school_id: null,
      teacherSchoolMembership: TeacherSchoolMembershipStatus.none,
      teacherPublicNameMasked: true,
      status: UserStatus.active,
      passwordHash: null,
      firebaseUid: uid,
    });
    const saved = await this.userRepo.save(newUser);
    return { token: saved.id, user: saved };
  }
}
