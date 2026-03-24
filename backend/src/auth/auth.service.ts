import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
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

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(PasswordResetToken)
    private readonly tokenRepo: Repository<PasswordResetToken>,
    private readonly emailService: EmailService,
    private readonly schoolsService: SchoolsService,
    private readonly teacherInvites: TeacherInviteService,
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
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'E-posta veya şifre hatalı.' });
    }
    return { token: user.id, user };
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
    return { token: saved.id, user: withSchool ?? saved };
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

  /** Firebase ID token doğrula; kullanıcı yoksa e-posta ile bul veya oluştur. Token olarak id_token döner (Bearer ile kullanılır). */
  async exchangeFirebaseToken(idToken: string): Promise<{ token: string; user: User }> {
    let app: admin.app.App | null = null;
    try {
      app = admin.app();
    } catch {
      // Firebase yok
    }
    if (!app) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Sosyal giriş şu an kullanılamıyor.' });
    }
    const decoded = await app.auth().verifyIdToken(idToken);
    const uid = decoded.uid;
    const email = (decoded.email as string)?.trim().toLowerCase() || null;
    const displayName = (decoded.name as string)?.trim() || null;

    let user = await this.userRepo.findOne({ where: { firebaseUid: uid }, relations: ['school'] });
    if (user) {
      return { token: idToken, user };
    }
    if (email) {
      user = await this.userRepo.findOne({ where: { email }, relations: ['school'] });
      if (user) {
        user.firebaseUid = uid;
        if (displayName && !user.display_name) user.display_name = displayName;
        await this.userRepo.save(user);
        return { token: idToken, user };
      }
    }
    if (!email) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'E-posta bilgisi alınamadı.' });
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
    return { token: idToken, user: saved };
  }
}
