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
import { TeacherInviteService } from '../teacher-invite/teacher-invite.service';
import { MailService } from '../mail/mail.service';
import { DEMO_CREDENTIALS } from '../seed/demo-credentials';
import { AuthOtpService } from './auth-otp.service';
import type { AuthOtpPurpose } from './entities/auth-verification-code.entity';
import { emailMatchesInstitutionalDomain, emailDomainFromInstitutional } from '../common/utils/institutional-email.util';
import { normalizeTeacherDisplayName } from '../common/utils/teacher-display-name.util';

const OTP_TTL_MIN = 12;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(PasswordResetToken)
    private readonly tokenRepo: Repository<PasswordResetToken>,
    private readonly schoolsService: SchoolsService,
    private readonly teacherInvites: TeacherInviteService,
    private readonly mailService: MailService,
    private readonly authOtp: AuthOtpService,
  ) {}

  private purposeLine(purpose: AuthOtpPurpose): string {
    const m: Record<AuthOtpPurpose, string> = {
      login_teacher: 'Öğretmen hesabınıza giriş için doğrulama kodunuz:',
      login_school: 'Okul yöneticisi girişi için doğrulama kodunuz:',
      register_teacher: 'Öğretmen kaydınızı tamamlamak için doğrulama kodunuz:',
      register_school: 'Okul yöneticisi kaydınızı tamamlamak için doğrulama kodunuz:',
      forgot_password: 'Şifre sıfırlama talebiniz için doğrulama kodunuz:',
      school_join: 'Okul başvurunuzda kurumsal e-postanızı doğrulamak için kodunuz:',
    };
    return m[purpose];
  }

  private async sendOtpMail(to: string, purpose: AuthOtpPurpose, code: string): Promise<boolean> {
    return this.mailService.sendVerificationCodeEmail(to, {
      code,
      purposeLine: this.purposeLine(purpose),
      ttlMinutes: OTP_TTL_MIN,
    });
  }

  private matchesDemoCredential(email: string, password: string): boolean {
    const envOk = ['local', 'development'].includes(env.nodeEnv) || env.allowDemoLogin;
    if (!envOk) return false;
    const e = email.trim().toLowerCase();
    for (const k of ['teacher', 'school_admin', 'superadmin'] as const) {
      const c = DEMO_CREDENTIALS[k];
      if (c.email === e && c.password === password) return true;
    }
    return false;
  }

  private async assertPassword(user: User, password: string, email: string): Promise<void> {
    const demoMatch = this.matchesDemoCredential(email, password);
    if (!user.passwordHash) {
      if (!demoMatch) {
        throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'E-posta veya şifre hatalı.' });
      }
      user.passwordHash = await bcrypt.hash(password, 10);
      await this.userRepo.save(user);
      return;
    }
    const bcryptOk = await bcrypt.compare(password, user.passwordHash);
    const localDemoOk = !bcryptOk && demoMatch;
    if (!bcryptOk && !localDemoOk) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'E-posta veya şifre hatalı.' });
    }
    if (localDemoOk) {
      user.passwordHash = await bcrypt.hash(password, 10);
      await this.userRepo.save(user);
    }
  }

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
    if (user && !user.emailVerifiedAt) {
      user.emailVerifiedAt = new Date();
      await this.userRepo.save(user);
    }
    return user ?? null;
  }

  async validateUserId(userId: string): Promise<User | null> {
    const user = await this.userRepo.findOne({
      where: { id: userId, status: UserStatus.active },
      relations: ['school'],
    });
    if (!user) return null;
    if (!user.emailVerifiedAt) {
      throw new UnauthorizedException({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'E-posta doğrulaması tamamlanmamış. Kayıt e-postanızdaki kodu girin veya yeniden kod isteyin.',
      });
    }
    return user;
  }

  isLocalJwtEnabled(): boolean {
    return !!env.jwt.secret && env.nodeEnv === 'local' && !env.firebase.projectId;
  }

  private teacherRoles(): UserRole[] {
    return [UserRole.teacher, UserRole.superadmin, UserRole.moderator];
  }

  async teacherLoginStep(
    email: string,
    password: string,
  ): Promise<
    | { token: string; user: User }
    | { needs_verification_code: true; email: string; otp_purpose: 'login_teacher' | 'register_teacher' }
  > {
    const normalized = email.trim().toLowerCase();
    const user = await this.userRepo.findOne({
      where: { email: normalized, status: UserStatus.active },
      relations: ['school'],
    });
    if (!user || !this.teacherRoles().includes(user.role as UserRole)) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'E-posta veya şifre hatalı.' });
    }
    await this.assertPassword(user, password, normalized);
    const demoSkip =
      ['local', 'development'].includes(env.nodeEnv) || env.allowDemoLogin
        ? this.matchesDemoCredential(normalized, password)
        : false;
    if (demoSkip) {
      if (!user.emailVerifiedAt) {
        user.emailVerifiedAt = new Date();
        await this.userRepo.save(user);
      }
      return { token: user.id, user };
    }
    if (!user.emailVerifiedAt) {
      const code = await this.authOtp.issue(normalized, 'register_teacher');
      await this.sendOtpMail(normalized, 'register_teacher', code);
      return { needs_verification_code: true, email: normalized, otp_purpose: 'register_teacher' };
    }
    const code = await this.authOtp.issue(normalized, 'login_teacher');
    const sent = await this.sendOtpMail(normalized, 'login_teacher', code);
    if (!sent) {
      this.logger.warn(`Öğretmen giriş OTP gönderilemedi: ${normalized}`);
    }
    return { needs_verification_code: true, email: normalized, otp_purpose: 'login_teacher' };
  }

  async teacherLoginVerify(email: string, code: string): Promise<{ token: string; user: User }> {
    const normalized = email.trim().toLowerCase();
    const user = await this.userRepo.findOne({
      where: { email: normalized, status: UserStatus.active },
      relations: ['school'],
    });
    if (!user || !this.teacherRoles().includes(user.role as UserRole)) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Oturum açılamadı.' });
    }
    if (!user.emailVerifiedAt) {
      await this.authOtp.verifyAndConsume(normalized, 'register_teacher', code);
      user.emailVerifiedAt = new Date();
      await this.userRepo.save(user);
      if (user.school_id && user.teacherSchoolMembership === TeacherSchoolMembershipStatus.pending && !user.schoolJoinEmailVerifiedAt) {
        const u2 = await this.userRepo.findOne({ where: { id: user.id }, relations: ['school'] });
        if (u2?.school) {
          const greet = u2.display_name?.trim() || u2.email.split('@')[0] || 'Merhaba';
          const c2 = await this.authOtp.issue(normalized, 'school_join');
          await this.sendOtpMail(normalized, 'school_join', c2);
          void this.mailService.sendTeacherSchoolPendingEmail(u2.email, {
            schoolName: u2.school.name,
            recipientName: greet,
          });
        }
      }
      return { token: user.id, user };
    }
    await this.authOtp.verifyAndConsume(normalized, 'login_teacher', code);
    const fresh = await this.userRepo.findOne({ where: { id: user.id }, relations: ['school'] });
    return { token: user.id, user: fresh ?? user };
  }

  async schoolLoginStep(
    email: string,
    password: string,
  ): Promise<
    | { token: string; user: User }
    | { needs_verification_code: true; email: string; otp_purpose: 'login_school' | 'register_school' }
  > {
    const normalized = email.trim().toLowerCase();
    const user = await this.userRepo.findOne({
      where: { email: normalized, status: UserStatus.active },
      relations: ['school'],
    });
    if (!user || user.role !== UserRole.school_admin) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'E-posta veya şifre hatalı.' });
    }
    await this.assertPassword(user, password, normalized);
    const demoSkip =
      (['local', 'development'].includes(env.nodeEnv) || env.allowDemoLogin) &&
      this.matchesDemoCredential(normalized, password);
    if (demoSkip) {
      if (!user.emailVerifiedAt) {
        user.emailVerifiedAt = new Date();
        await this.userRepo.save(user);
      }
      return { token: user.id, user };
    }
    if (!user.emailVerifiedAt) {
      const code = await this.authOtp.issue(normalized, 'register_school');
      await this.sendOtpMail(normalized, 'register_school', code);
      return { needs_verification_code: true, email: normalized, otp_purpose: 'register_school' };
    }
    const code = await this.authOtp.issue(normalized, 'login_school');
    const sent = await this.sendOtpMail(normalized, 'login_school', code);
    if (!sent) {
      this.logger.warn(`Okul giriş OTP gönderilemedi: ${normalized}`);
    }
    return { needs_verification_code: true, email: normalized, otp_purpose: 'login_school' };
  }

  async schoolLoginVerify(email: string, code: string): Promise<{ token: string; user: User }> {
    const normalized = email.trim().toLowerCase();
    const user = await this.userRepo.findOne({
      where: { email: normalized, status: UserStatus.active },
      relations: ['school'],
    });
    if (!user || user.role !== UserRole.school_admin) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Oturum açılamadı.' });
    }
    if (!user.emailVerifiedAt) {
      await this.authOtp.verifyAndConsume(normalized, 'register_school', code);
      user.emailVerifiedAt = new Date();
      await this.userRepo.save(user);
    } else {
      await this.authOtp.verifyAndConsume(normalized, 'login_school', code);
    }
    const fresh = await this.userRepo.findOne({ where: { id: user.id }, relations: ['school'] });
    return { token: user.id, user: fresh ?? user };
  }

  async register(
    email: string,
    password: string,
    displayName?: string,
    schoolId?: string | null,
    inviteCode?: string | null,
  ): Promise<{ verification_required: true; email: string }> {
    const normalized = email.trim().toLowerCase();
    const existing = await this.userRepo.findOne({ where: { email: normalized } });
    if (existing) {
      throw new ConflictException({ code: 'EMAIL_EXISTS', message: 'Bu e-posta adresi zaten kayıtlı.' });
    }
    let school_id: string | null = null;
    let membership = TeacherSchoolMembershipStatus.none;
    const sid = schoolId?.trim();
    let mergeSchool: { id: string; status: SchoolStatus; mergeTeacherOnNameMatch: boolean } | null = null;
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
      mergeSchool = school;
    }
    const passwordHash = await bcrypt.hash(password, 10);

    const mergeWithAdminStub = async (): Promise<User | null> => {
      if (!school_id || !mergeSchool?.mergeTeacherOnNameMatch || !displayName?.trim()) return null;
      const targetNorm = normalizeTeacherDisplayName(displayName);
      if (!targetNorm) return null;
      const candidates = await this.userRepo.find({
        where: { school_id, role: UserRole.teacher },
      });
      const stubs = candidates.filter(
        (u) =>
          !u.passwordHash &&
          !u.firebaseUid &&
          normalizeTeacherDisplayName(u.display_name) === targetNorm,
      );
      if (stubs.length > 1) {
        throw new BadRequestException({
          code: 'AMBIGUOUS_NAME_MERGE',
          message:
            'Aynı ada sahip birden fazla ön kayıt var. Okul yöneticisi listeden fazlalığı kaldırmalı veya ayarı kapatabilir.',
        });
      }
      if (stubs.length !== 1) return null;
      const u = stubs[0];
      const prevEmail = u.email;
      const prevPasswordHash = u.passwordHash;
      u.email = normalized;
      u.passwordHash = passwordHash;
      u.display_name = displayName.trim() || u.display_name;
      u.emailVerifiedAt = null;
      const saved = await this.userRepo.save(u);
      if (inviteCode?.trim()) {
        try {
          await this.teacherInvites.redeemAfterRegistration(saved.id, inviteCode);
        } catch (e) {
          saved.email = prevEmail;
          saved.passwordHash = prevPasswordHash;
          await this.userRepo.save(saved);
          throw e;
        }
      }
      return saved;
    };

    const merged = await mergeWithAdminStub();
    let saved: User;
    if (merged) {
      saved = merged;
    } else {
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
        schoolJoinEmailToken: null,
        schoolJoinEmailTokenExpiresAt: null,
        schoolJoinEmailVerifiedAt: null,
        emailVerifiedAt: null,
      });
      saved = await this.userRepo.save(user);
      if (inviteCode?.trim()) {
        try {
          await this.teacherInvites.redeemAfterRegistration(saved.id, inviteCode);
        } catch (e) {
          await this.userRepo.delete(saved.id);
          throw e;
        }
      }
    }
    const code = await this.authOtp.issue(normalized, 'register_teacher');
    const sent = await this.sendOtpMail(normalized, 'register_teacher', code);
    if (!sent) {
      this.logger.warn(`Kayıt OTP gönderilemedi: ${normalized}`);
    }
    return { verification_required: true, email: normalized };
  }

  async completeTeacherRegister(email: string, code: string): Promise<{ token: string; user: User; school_verify_email_sent?: boolean }> {
    const normalized = email.trim().toLowerCase();
    await this.authOtp.verifyAndConsume(normalized, 'register_teacher', code);
    const user = await this.userRepo.findOne({ where: { email: normalized }, relations: ['school'] });
    if (!user || user.role !== UserRole.teacher) {
      throw new BadRequestException({ code: 'INVALID', message: 'Kayıt bulunamadı.' });
    }
    user.emailVerifiedAt = new Date();
    await this.userRepo.save(user);
    let school_verify_email_sent: boolean | undefined;
    if (user.school_id && user.teacherSchoolMembership === TeacherSchoolMembershipStatus.pending && !user.schoolJoinEmailVerifiedAt) {
      const u2 = await this.userRepo.findOne({ where: { id: user.id }, relations: ['school'] });
      if (u2?.school) {
        const greet = u2.display_name?.trim() || u2.email.split('@')[0] || 'Merhaba';
        const c2 = await this.authOtp.issue(normalized, 'school_join');
        school_verify_email_sent = await this.sendOtpMail(normalized, 'school_join', c2);
        void this.mailService.sendTeacherSchoolPendingEmail(u2.email, {
          schoolName: u2.school.name,
          recipientName: greet,
        });
      }
    }
    const withSchool = await this.userRepo.findOne({ where: { id: user.id }, relations: ['school'] });
    return { token: user.id, user: withSchool ?? user, school_verify_email_sent };
  }

  async lookupSchoolByInstitutionCode(code: string): Promise<{
    school_id: string;
    name: string;
    city: string | null;
    district: string | null;
    type: string | null;
    institution_code: string | null;
    required_email_domain: string | null;
    institutional_email_sample: string | null;
  }> {
    const school = await this.schoolsService.findActiveByInstitutionCode(code);
    if (!school) {
      throw new BadRequestException({
        code: 'INSTITUTION_NOT_FOUND',
        message: 'Kurum kodu ile eşleşen aktif okul bulunamadı.',
      });
    }
    const dom =
      school.institutionalEmail?.includes('@') && school.institutionalEmail.trim()
        ? school.institutionalEmail.trim().toLowerCase().split('@').pop() ?? null
        : null;
    if (!dom) {
      throw new BadRequestException({
        code: 'INSTITUTION_EMAIL_MISSING',
        message: 'Bu okul için kurumsal e-posta tanımlı değil; kayıt için sistem yöneticisine başvurun.',
      });
    }
    return {
      school_id: school.id,
      name: school.name,
      city: school.city ?? null,
      district: school.district ?? null,
      type: school.type ?? null,
      institution_code: school.institutionCode?.trim() || code.trim(),
      required_email_domain: dom,
      institutional_email_sample: school.institutionalEmail,
    };
  }

  async registerSchoolAdmin(
    institutionCode: string,
    email: string,
    password: string,
    displayName?: string,
  ): Promise<{ verification_required: true; email: string; school_id: string }> {
    const school = await this.schoolsService.findActiveByInstitutionCode(institutionCode.trim());
    if (!school?.institutionalEmail?.trim()) {
      throw new BadRequestException({
        code: 'INSTITUTION_EMAIL_MISSING',
        message: 'Kurumsal e-posta tanımlı değil.',
      });
    }
    if (!emailMatchesInstitutionalDomain(email, school.institutionalEmail)) {
      throw new BadRequestException({
        code: 'EMAIL_DOMAIN_MISMATCH',
        message: `Kayıt yalnızca okul kurumsal alan adı ile yapılabilir (@${emailDomainFromInstitutional(school.institutionalEmail)}).`,
      });
    }
    const admins = await this.schoolsService.countSchoolAdmins(school.id);
    if (admins > 0) {
      throw new ConflictException({
        code: 'SCHOOL_ADMIN_EXISTS',
        message: 'Bu okul için zaten yönetici kaydı var. Mevcut hesap ile giriş yapın.',
      });
    }
    const normalized = email.trim().toLowerCase();
    const existing = await this.userRepo.findOne({ where: { email: normalized } });
    if (existing) {
      throw new ConflictException({ code: 'EMAIL_EXISTS', message: 'Bu e-posta adresi zaten kayıtlı.' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = this.userRepo.create({
      email: normalized,
      display_name: displayName?.trim() || null,
      role: UserRole.school_admin,
      school_id: school.id,
      teacherSchoolMembership: TeacherSchoolMembershipStatus.none,
      teacherPublicNameMasked: true,
      status: UserStatus.active,
      passwordHash,
      firebaseUid: null,
      emailVerifiedAt: null,
    });
    await this.userRepo.save(user);
    const code = await this.authOtp.issue(normalized, 'register_school');
    const sent = await this.sendOtpMail(normalized, 'register_school', code);
    if (!sent) {
      this.logger.warn(`Okul kayıt OTP gönderilemedi: ${normalized}`);
    }
    return { verification_required: true, email: normalized, school_id: school.id };
  }

  async completeSchoolRegister(email: string, code: string): Promise<{ token: string; user: User }> {
    const normalized = email.trim().toLowerCase();
    await this.authOtp.verifyAndConsume(normalized, 'register_school', code);
    const user = await this.userRepo.findOne({ where: { email: normalized }, relations: ['school'] });
    if (!user || user.role !== UserRole.school_admin) {
      throw new BadRequestException({ code: 'INVALID', message: 'Kayıt bulunamadı.' });
    }
    user.emailVerifiedAt = new Date();
    await this.userRepo.save(user);
    const fresh = await this.userRepo.findOne({ where: { id: user.id }, relations: ['school'] });
    return { token: user.id, user: fresh ?? user };
  }

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

  async verifySchoolJoinCode(userId: string, code: string): Promise<{ ok: boolean }> {
    const user = await this.userRepo.findOne({ where: { id: userId }, relations: ['school'] });
    if (!user || user.role !== UserRole.teacher || !user.school_id) {
      throw new BadRequestException({ code: 'INVALID', message: 'Okul başvurusu bulunamadı.' });
    }
    if (user.schoolJoinEmailVerifiedAt) {
      return { ok: true };
    }
    await this.authOtp.verifyAndConsume(user.email, 'school_join', code);
    user.schoolJoinEmailVerifiedAt = new Date();
    user.schoolJoinEmailToken = null;
    user.schoolJoinEmailTokenExpiresAt = null;
    await this.userRepo.save(user);
    return { ok: true };
  }

  async forgotPassword(email: string): Promise<{ ok: boolean; message: string }> {
    const normalized = email.trim().toLowerCase();
    const user = await this.userRepo.findOne({ where: { email: normalized } });
    if (!user) {
      return { ok: true, message: 'E-posta adresiniz kayıtlıysa doğrulama kodu gönderildi.' };
    }
    if (!user.passwordHash) {
      return {
        ok: true,
        message: 'Bu hesap sosyal giriş ile oluşturulmuş; şifre sıfırlama uygulanamaz.',
      };
    }
    const code = await this.authOtp.issue(normalized, 'forgot_password');
    const sent = await this.sendOtpMail(normalized, 'forgot_password', code);
    if (!sent) {
      return {
        ok: false,
        message: 'Doğrulama kodu gönderilemedi. SMTP ayarlarını kontrol edin.',
      };
    }
    return { ok: true, message: 'E-posta adresinize doğrulama kodu gönderildi.' };
  }

  async resetPasswordWithCode(email: string, code: string, newPassword: string): Promise<{ ok: boolean }> {
    const normalized = email.trim().toLowerCase();
    if (newPassword.length < 8) {
      throw new BadRequestException({ code: 'INVALID_INPUT', message: 'Şifre en az 8 karakter olmalıdır.' });
    }
    await this.authOtp.verifyAndConsume(normalized, 'forgot_password', code);
    const user = await this.userRepo.findOne({ where: { email: normalized } });
    if (!user?.passwordHash) {
      throw new BadRequestException({ code: 'INVALID', message: 'İşlem uygulanamadı.' });
    }
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await this.userRepo.save(user);
    return { ok: true };
  }

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
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await this.userRepo.save(user);
    await this.tokenRepo.delete({ id: record.id });
    return { ok: true };
  }

  async resendOtp(email: string, purpose: AuthOtpPurpose): Promise<{ ok: boolean; message: string }> {
    const normalized = email.trim().toLowerCase();
    const user = await this.userRepo.findOne({ where: { email: normalized } });
    if (!user && purpose !== 'register_teacher' && purpose !== 'register_school') {
      return { ok: true, message: 'Kayıtlıysa kod gönderildi.' };
    }
    if (purpose === 'register_teacher' && user && user.emailVerifiedAt) {
      return { ok: false, message: 'E-posta zaten doğrulanmış.' };
    }
    if (purpose === 'register_school' && user && user.emailVerifiedAt) {
      return { ok: false, message: 'E-posta zaten doğrulanmış.' };
    }
    if (purpose === 'school_join' && user) {
      if (user.role !== UserRole.teacher || !user.school_id || user.schoolJoinEmailVerifiedAt) {
        return { ok: false, message: 'Bu aşamada kod gönderilmez.' };
      }
    }
    const code = await this.authOtp.issue(normalized, purpose);
    const sent = await this.sendOtpMail(normalized, purpose, code);
    if (!sent) {
      return { ok: false, message: 'Kod gönderilemedi (SMTP).' };
    }
    return { ok: true, message: 'Yeni kod gönderildi.' };
  }

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
    const emailVerifiedFromProvider = decoded.email_verified === true;

    let user = await this.userRepo.findOne({ where: { firebaseUid: uid }, relations: ['school'] });
    if (user) {
      if (!user.emailVerifiedAt && (emailVerifiedFromProvider || user.email?.endsWith('@phone.ogretmenpro.local'))) {
        user.emailVerifiedAt = new Date();
        await this.userRepo.save(user);
      }
      return { token: user.id, user };
    }
    if (email) {
      user = await this.userRepo.findOne({ where: { email }, relations: ['school'] });
      if (user) {
        user.firebaseUid = uid;
        if (displayName && !user.display_name) user.display_name = displayName;
        if (phoneE164 && !user.teacherPhone) user.teacherPhone = phoneE164;
        if (!user.emailVerifiedAt && emailVerifiedFromProvider) {
          user.emailVerifiedAt = new Date();
        }
        await this.userRepo.save(user);
        return { token: user.id, user };
      }
    }
    if (!email && phoneE164) {
      user = await this.userRepo.findOne({
        where: { teacherPhone: phoneE164 },
        relations: ['school'],
      });
      if (user) {
        user.firebaseUid = uid;
        if (!user.emailVerifiedAt) user.emailVerifiedAt = new Date();
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
        emailVerifiedAt: new Date(),
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
      emailVerifiedAt: new Date(),
    });
    const saved = await this.userRepo.save(newUser);
    return { token: saved.id, user: saved };
  }
}
