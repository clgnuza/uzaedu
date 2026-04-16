import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import {
  UserRole,
  UserStatus,
  TeacherSchoolMembershipStatus,
  SchoolStatus,
} from '../types/enums';
import { SchoolsService } from '../schools/schools.service';
import { effectiveTeacherSchoolMembership } from '../common/utils/teacher-school-membership';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { paginate } from '../common/dtos/pagination.dto';
import { TeacherAgendaImportService } from '../teacher-agenda/teacher-agenda-import.service';
import { MailService } from '../mail/mail.service';
import { schoolJoinStage, SchoolJoinStage } from '../common/utils/school-join-stage';
import { AuthOtpService } from '../auth/auth-otp.service';
import {
  parseMebbisPersonnelSheet,
  syntheticMebbisEmail,
  mebbisPlaceholderEmailsForLookup,
  type ParsedMebbisPerson,
} from './mebbis-personnel-xls.parser';
import { normalizeTeacherDisplayName } from '../common/utils/teacher-display-name.util';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly schoolsService: SchoolsService,
    private readonly teacherAgendaImportService: TeacherAgendaImportService,
    private readonly mailService: MailService,
    private readonly authOtp: AuthOtpService,
  ) {}

  private async sendSchoolJoinOtpEmail(user: User, schoolName: string): Promise<boolean> {
    const code = await this.authOtp.issue(user.email, 'school_join');
    return this.mailService.sendVerificationCodeEmail(user.email, {
      code,
      purposeLine: 'Okul başvurunuzda kurumsal e-postanızı doğrulamak için kodunuz:',
      ttlMinutes: 12,
    });
  }

  async findById(id: string, relations: ('school')[] = ['school']): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id }, relations });
    if (!user) throw new NotFoundException({ code: 'NOT_FOUND', message: 'İstediğiniz kayıt bulunamadı.' });
    return user;
  }

  async findByIdOrNull(id: string, relations: ('school')[] = ['school']): Promise<User | null> {
    return this.userRepo.findOne({ where: { id }, relations });
  }

  async list(
    dto: ListUsersDto,
    scope: { role: UserRole; schoolId: string | null },
  ): Promise<{ total: number; page: number; limit: number; items: User[] }> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const qb = this.userRepo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.school', 'school')
      .skip((page - 1) * limit)
      .take(limit);

    if (dto.sort === 'teacher_branch') {
      qb.orderBy('u.teacherBranch', 'ASC', 'NULLS LAST').addOrderBy('u.display_name', 'ASC');
    } else {
      qb.orderBy('u.created_at', 'DESC');
    }

    if (scope.role === UserRole.school_admin) {
      if (!scope.schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
      qb.andWhere('u.school_id = :schoolId', { schoolId: scope.schoolId });
    }
    if (dto.school_id) qb.andWhere('u.school_id = :schoolId', { schoolId: dto.school_id });
    if (dto.role) {
      // Öğretmen listesi: school_admin da ders veriyorsa listeye dahil et (tek hesap, çift rol yok)
      if (
        dto.role === UserRole.teacher &&
        scope.role === UserRole.school_admin
      ) {
        qb.andWhere('u.role IN (:...teacherOrAdmin)', {
          teacherOrAdmin: [UserRole.teacher, UserRole.school_admin],
        });
      } else {
        qb.andWhere('u.role = :role', { role: dto.role });
      }
    }
    if (dto.status) qb.andWhere('u.status = :status', { status: dto.status });
    if (dto.teacher_school_membership === TeacherSchoolMembershipStatus.approved) {
      qb.andWhere(
        '(u.teacher_school_membership = :ap OR (u.teacher_school_membership = :none AND u.school_id IS NOT NULL AND u.role = :tr))',
        {
          ap: TeacherSchoolMembershipStatus.approved,
          none: TeacherSchoolMembershipStatus.none,
          tr: UserRole.teacher,
        },
      );
    } else if (dto.teacher_school_membership === TeacherSchoolMembershipStatus.none) {
      qb.andWhere('u.teacher_school_membership = :tsm AND u.school_id IS NULL', {
        tsm: TeacherSchoolMembershipStatus.none,
      });
    } else if (dto.teacher_school_membership) {
      qb.andWhere('u.teacher_school_membership = :tsm', { tsm: dto.teacher_school_membership });
    }
    if (dto.search?.trim()) {
      const q = `%${dto.search.trim().toLowerCase()}%`;
      qb.andWhere('(LOWER(u.email) LIKE :q OR LOWER(u.display_name) LIKE :q)', { q });
    }

    const [items, total] = await qb.getManyAndCount();
    return paginate(items, total, page, limit);
  }

  /** Okul panelindeki öğretmen sayacı ile aynı (öğretmen + ders veren okul yöneticisi). */
  async countTeachersForSchool(schoolId: string): Promise<number> {
    return this.userRepo
      .createQueryBuilder('u')
      .where('u.school_id = :schoolId', { schoolId })
      .andWhere('u.role IN (:...roles)', { roles: [UserRole.teacher, UserRole.school_admin] })
      .getCount();
  }

  async importMebbisPersonnelXls(
    buffer: Buffer,
    scope: { role: UserRole; schoolId: string | null },
  ): Promise<{
    added: number;
    skipped_existing: number;
    skipped_duplicate_in_file: number;
    skipped_limit: number;
    errors: { row: number; message: string }[];
  }> {
    if (scope.role !== UserRole.school_admin || !scope.schoolId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Yalnızca okul yöneticisi bu dosyayı yükleyebilir.' });
    }
    const schoolId = scope.schoolId;
    let rows: ParsedMebbisPerson[];
    try {
      rows = parseMebbisPersonnelSheet(buffer);
    } catch {
      throw new BadRequestException({ code: 'PARSE', message: 'Excel dosyası okunamadı.' });
    }
    if (rows.length > 2500) {
      throw new BadRequestException({ code: 'TOO_MANY_ROWS', message: 'En fazla 2500 öğretmen satırı işlenebilir.' });
    }
    const school = await this.schoolsService.findById(schoolId);
    const limit = school.teacher_limit ?? 100;
    let slots = Math.max(0, limit - (await this.countTeachersForSchool(schoolId)));

    const unique: ParsedMebbisPerson[] = [];
    const seenTc = new Set<string>();
    let skipped_duplicate_in_file = 0;
    for (const r of rows) {
      if (seenTc.has(r.tc)) {
        skipped_duplicate_in_file += 1;
        continue;
      }
      seenTc.add(r.tc);
      unique.push(r);
    }

    const emails = unique.flatMap((r) => mebbisPlaceholderEmailsForLookup(schoolId, r.tc));
    const existing = emails.length
      ? await this.userRepo.find({ where: { email: In([...new Set(emails)]) }, select: ['email'] })
      : [];
    const existingSet = new Set(existing.map((u) => u.email.toLowerCase()));

    let added = 0;
    let skipped_existing = 0;
    let skipped_limit = 0;
    const errors: { row: number; message: string }[] = [];

    for (const r of unique) {
      const email = syntheticMebbisEmail(schoolId, r.tc);
      const [shortPh, longPh] = mebbisPlaceholderEmailsForLookup(schoolId, r.tc);
      if (existingSet.has(shortPh) || existingSet.has(longPh)) {
        skipped_existing += 1;
        continue;
      }
      if (slots <= 0) {
        skipped_limit += 1;
        continue;
      }
      try {
        const user = this.userRepo.create({
          email,
          display_name: r.displayName,
          role: UserRole.teacher,
          school_id: schoolId,
          teacherSchoolMembership: TeacherSchoolMembershipStatus.approved,
          teacherPublicNameMasked: true,
          status: UserStatus.active,
          firebaseUid: null,
          passwordHash: null,
          teacherBranch: r.teacherBranch,
          teacherPhone: null,
          teacherTitle: r.teacherTitle,
          avatarUrl: null,
          teacherSubjectIds: null,
          moderatorModules: null,
          schoolJoinEmailToken: null,
          schoolJoinEmailTokenExpiresAt: null,
          schoolJoinEmailVerifiedAt: null,
          emailVerifiedAt: null,
        });
        await this.userRepo.save(user);
        existingSet.add(email);
        slots -= 1;
        added += 1;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Kayıt oluşturulamadı';
        errors.push({ row: r.sheetRow, message: msg });
      }
    }

    return { added, skipped_existing, skipped_duplicate_in_file, skipped_limit, errors };
  }

  async create(dto: CreateUserDto, scopeSchoolId: string | null): Promise<User> {
    if (scopeSchoolId !== null) {
      if (dto.role !== UserRole.teacher) {
        throw new ForbiddenException({ code: 'ONLY_TEACHERS', message: 'Yalnızca öğretmen ekleyebilirsiniz.' });
      }
      dto.school_id = scopeSchoolId;
      const school = await this.schoolsService.findById(scopeSchoolId);
      const n = await this.countTeachersForSchool(scopeSchoolId);
      if (n >= (school.teacher_limit ?? 100)) {
        throw new BadRequestException({
          code: 'TEACHER_LIMIT',
          message: `Öğretmen limiti (${school.teacher_limit ?? 100}) dolu.`,
        });
      }
    }
    const dup = await this.userRepo.findOne({ where: { email: dto.email.trim().toLowerCase() } });
    if (dup) {
      throw new ConflictException({ code: 'EMAIL_EXISTS', message: 'Bu e-posta adresi zaten kayıtlı.' });
    }
    const sid = dto.school_id ?? null;
    const user = this.userRepo.create({
      email: dto.email,
      display_name: dto.display_name ?? null,
      role: dto.role,
      school_id: sid,
      teacherSchoolMembership:
        dto.role === UserRole.teacher && sid
          ? TeacherSchoolMembershipStatus.approved
          : TeacherSchoolMembershipStatus.none,
      teacherPublicNameMasked: dto.role === UserRole.teacher,
      status: dto.status ?? UserStatus.active,
      firebaseUid: dto.firebase_uid ?? null,
      teacherBranch: dto.teacher_branch ?? null,
      teacherPhone: dto.teacher_phone ?? null,
      teacherTitle: dto.teacher_title ?? null,
      avatarUrl: dto.avatar_url ?? null,
      teacherSubjectIds: dto.teacher_subject_ids ?? null,
      moderatorModules: dto.moderator_modules ?? null,
    });
    return this.userRepo.save(user);
  }

  async update(id: string, dto: UpdateUserDto, scope: { role: UserRole; schoolId: string | null; userId: string }): Promise<User> {
    const user = await this.findById(id);
    if (scope.role === UserRole.teacher && user.id !== scope.userId) {
      throw new ForbiddenException({ code: 'SCOPE_VIOLATION', message: 'Bu veriye erişim yetkiniz yok.' });
    }
    if (scope.role === UserRole.school_admin && user.school_id !== scope.schoolId) {
      throw new ForbiddenException({ code: 'SCOPE_VIOLATION', message: 'Bu veriye erişim yetkiniz yok.' });
    }
    if (scope.role === UserRole.school_admin && user.role === UserRole.teacher) {
      const forbidden: (keyof UpdateUserDto)[] = [
        'display_name',
        'role',
        'school_id',
        'teacher_branch',
        'teacher_phone',
        'teacher_title',
        'avatar_url',
        'teacher_subject_ids',
        'moderator_modules',
        'teacher_school_membership',
      ];
      for (const k of forbidden) {
        if (dto[k] !== undefined) {
          throw new ForbiddenException({
            code: 'CANNOT_EDIT_TEACHER_PROFILE',
            message:
              'Okul yöneticisi öğretmenin ad, iletişim ve profil alanlarını değiştiremez; öğretmen kendi hesabından günceller.',
          });
        }
      }
    }
    if (dto.display_name !== undefined) user.display_name = dto.display_name;
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.school_id !== undefined) {
      const next = dto.school_id ? String(dto.school_id).trim() : null;
      if (user.role === UserRole.teacher) {
        if (!next) {
          user.school_id = null;
          user.teacherSchoolMembership = TeacherSchoolMembershipStatus.none;
          user.schoolJoinEmailToken = null;
          user.schoolJoinEmailTokenExpiresAt = null;
          user.schoolJoinEmailVerifiedAt = null;
        } else {
          const school = await this.schoolsService.findById(next);
          if (school.status !== SchoolStatus.aktif) {
            throw new BadRequestException({
              code: 'SCHOOL_NOT_ACTIVE',
              message: 'Seçilen okul aktif değil veya bulunamadı.',
            });
          }
          user.school_id = next;
          user.teacherSchoolMembership = TeacherSchoolMembershipStatus.pending;
          user.schoolJoinEmailToken = null;
          user.schoolJoinEmailTokenExpiresAt = null;
          user.schoolJoinEmailVerifiedAt = null;
        }
      } else {
        user.school_id = next;
      }
    }
    if (dto.status !== undefined) user.status = dto.status;
    if (dto.teacher_branch !== undefined) user.teacherBranch = dto.teacher_branch;
    if (dto.teacher_phone !== undefined) user.teacherPhone = dto.teacher_phone;
    if (dto.teacher_title !== undefined) user.teacherTitle = dto.teacher_title;
    if (dto.avatar_url !== undefined) user.avatarUrl = dto.avatar_url;
    if (dto.teacher_subject_ids !== undefined) user.teacherSubjectIds = dto.teacher_subject_ids;
    if (dto.moderator_modules !== undefined) user.moderatorModules = dto.moderator_modules;
    if (dto.duty_exempt !== undefined) user.dutyExempt = dto.duty_exempt;
    if (dto.duty_exempt_reason !== undefined) user.dutyExemptReason = dto.duty_exempt_reason;
    if (dto.teacher_school_membership !== undefined) {
      if (scope.role !== UserRole.superadmin && scope.role !== UserRole.school_admin) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: 'Okul üyeliği durumu yalnızca okul yöneticisi veya süper yönetici tarafından ayarlanabilir.',
        });
      }
      if (user.role !== UserRole.teacher) {
        throw new BadRequestException({ code: 'INVALID_ROLE', message: 'Sadece öğretmen hesapları için geçerlidir.' });
      }
      if (dto.teacher_school_membership === TeacherSchoolMembershipStatus.approved) {
        await this.assertTeacherSchoolApproveAllowed(user);
      } else if (dto.teacher_school_membership === TeacherSchoolMembershipStatus.rejected) {
        user.school_id = null;
        user.schoolJoinEmailToken = null;
        user.schoolJoinEmailTokenExpiresAt = null;
        user.schoolJoinEmailVerifiedAt = null;
      } else if (dto.teacher_school_membership === TeacherSchoolMembershipStatus.none) {
        user.school_id = null;
        user.schoolJoinEmailToken = null;
        user.schoolJoinEmailTokenExpiresAt = null;
        user.schoolJoinEmailVerifiedAt = null;
      }
      user.teacherSchoolMembership = dto.teacher_school_membership;
    }
    const saved = await this.userRepo.save(user);
    if (dto.school_id !== undefined && user.role === UserRole.teacher) {
      const next = dto.school_id ? String(dto.school_id).trim() : null;
      if (next && saved.school_id === next && !saved.schoolJoinEmailVerifiedAt) {
        const school = await this.schoolsService.findById(next);
        void this.sendSchoolJoinOtpEmail(saved, school.name).catch(() => {});
      }
    }
    return saved;
  }

  async updateMe(userId: string, dto: UpdateMeDto): Promise<User> {
    const user = await this.findById(userId);
    if (dto.display_name !== undefined) {
      const v = dto.display_name;
      if (v !== null && typeof v === 'string' && v.includes('\0')) {
        throw new BadRequestException({ code: 'INVALID_INPUT', message: 'Geçersiz karakter.' });
      }
      user.display_name = dto.display_name;
    }
    if (dto.evrak_defaults !== undefined) {
      const incoming =
        typeof dto.evrak_defaults === 'object' && dto.evrak_defaults !== null
          ? (JSON.parse(JSON.stringify(dto.evrak_defaults)) as Record<string, unknown>)
          : {};
      const existing = (user.evrakDefaults ?? {}) as Record<string, unknown>;
      user.evrakDefaults = { ...existing, ...incoming } as Record<string, unknown>;
    }
    if (dto.school_id !== undefined) {
      if (user.role !== UserRole.teacher) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: 'Okul bağlantısı yalnızca öğretmen hesapları için değiştirilebilir.',
        });
      }
      const next = dto.school_id ? String(dto.school_id).trim() : null;
      if (next !== (user.school_id ?? null)) {
        if (next) {
          const school = await this.schoolsService.findById(next);
          if (school.status !== SchoolStatus.aktif) {
            throw new BadRequestException({
              code: 'SCHOOL_NOT_ACTIVE',
              message: 'Seçilen okul aktif değil veya bulunamadı.',
            });
          }
          user.school_id = next;
          user.teacherSchoolMembership = TeacherSchoolMembershipStatus.pending;
          user.schoolJoinEmailToken = null;
          user.schoolJoinEmailTokenExpiresAt = null;
          user.schoolJoinEmailVerifiedAt = null;
        } else {
          user.school_id = null;
          user.teacherSchoolMembership = TeacherSchoolMembershipStatus.none;
          user.schoolJoinEmailToken = null;
          user.schoolJoinEmailTokenExpiresAt = null;
          user.schoolJoinEmailVerifiedAt = null;
        }
      }
    }
    if (dto.teacher_public_name_masked !== undefined) {
      user.teacherPublicNameMasked = dto.teacher_public_name_masked;
    }
    if (dto.login_otp_required !== undefined) {
      const allowed = [UserRole.teacher, UserRole.school_admin, UserRole.superadmin, UserRole.moderator].includes(
        user.role as UserRole,
      );
      if (!allowed) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: 'Giriş doğrulama ayarı bu hesap türü için kullanılamaz.',
        });
      }
      user.loginOtpRequired = dto.login_otp_required;
    }
    if (dto.teacher_branch !== undefined) {
      const b = dto.teacher_branch?.trim() || null;
      if (b?.includes('\0')) {
        throw new BadRequestException({ code: 'INVALID_INPUT', message: 'Geçersiz karakter.' });
      }
      user.teacherBranch = b;
    }
    if (dto.avatar_key !== undefined) {
      user.avatarKey = dto.avatar_key;
    }
    const saved = await this.userRepo.save(user);
    if (dto.school_id !== undefined && user.role === UserRole.teacher) {
      const next = dto.school_id ? String(dto.school_id).trim() : null;
      if (next && saved.school_id === next && !saved.schoolJoinEmailVerifiedAt) {
        const school = await this.schoolsService.findById(next);
        void this.sendSchoolJoinOtpEmail(saved, school.name).catch(() => {});
      }
    }
    return saved;
  }

  async resendSchoolJoinEmail(userId: string): Promise<{ ok: boolean }> {
    const user = await this.findById(userId);
    if (user.role !== UserRole.teacher || !user.school_id) {
      throw new BadRequestException({ code: 'INVALID', message: 'Okul bağlantısı yok.' });
    }
    if (user.teacherSchoolMembership !== TeacherSchoolMembershipStatus.pending) {
      throw new BadRequestException({ code: 'NOT_PENDING', message: 'Bu aşamada doğrulama e-postası gönderilmez.' });
    }
    if (user.schoolJoinEmailVerifiedAt) {
      throw new BadRequestException({ code: 'ALREADY_VERIFIED', message: 'E-posta zaten doğrulanmış.' });
    }
    user.schoolJoinEmailToken = null;
    user.schoolJoinEmailTokenExpiresAt = null;
    await this.userRepo.save(user);
    const school = await this.schoolsService.findById(user.school_id);
    const sent = await this.sendSchoolJoinOtpEmail(user, school.name);
    if (!sent) {
      throw new BadRequestException({
        code: 'MAIL_NOT_CONFIGURED',
        message: 'E-posta sunucusu kapalı veya yapılandırılmamış.',
      });
    }
    return { ok: true };
  }

  async listSchoolJoinQueue(scope: { role: UserRole; schoolId: string | null }): Promise<{
    items: {
      id: string;
      email: string;
      display_name: string | null;
      school: { id: string; name: string } | null;
      school_join_stage: SchoolJoinStage;
      school_join_email_verified_at: string | null;
      created_at: string;
    }[];
  }> {
    if (scope.role === UserRole.school_admin && !scope.schoolId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Okul bilgisi yok.' });
    }
    const where: FindOptionsWhere<User> = {
      role: UserRole.teacher,
      teacherSchoolMembership: TeacherSchoolMembershipStatus.pending,
    };
    if (scope.role === UserRole.school_admin) {
      where.school_id = scope.schoolId!;
    }
    const rows = await this.userRepo.find({
      where,
      relations: ['school'],
      order: { created_at: 'ASC' },
    });
    const items = rows
      .filter((u) => u.school_id)
      .map((u) => ({
        id: u.id,
        email: u.email,
        display_name: u.display_name,
        school: u.school ? { id: u.school.id, name: u.school.name } : null,
        school_join_stage: schoolJoinStage(u),
        school_join_email_verified_at: u.schoolJoinEmailVerifiedAt?.toISOString() ?? null,
        created_at: u.created_at.toISOString(),
      }));
    return { items };
  }

  /** Yedek JSON’dan (export) güvenli profil alanları — e-posta/rol/okul ataması değişmez. */
  async applyAccountFromExport(userId: string, account: Record<string, unknown>): Promise<void> {
    const user = await this.findById(userId);
    if (typeof account.display_name === 'string' || account.display_name === null) {
      const v = account.display_name;
      if (v !== null && typeof v === 'string' && v.includes('\0')) {
        throw new BadRequestException({ code: 'INVALID_INPUT', message: 'Geçersiz karakter.' });
      }
      user.display_name = v as string | null;
    }
    if (account.teacher_branch !== undefined) {
      const b = typeof account.teacher_branch === 'string' ? account.teacher_branch.trim() || null : null;
      if (b?.includes('\0')) {
        throw new BadRequestException({ code: 'INVALID_INPUT', message: 'Geçersiz karakter.' });
      }
      user.teacherBranch = b;
    }
    if (typeof account.teacher_public_name_masked === 'boolean') {
      user.teacherPublicNameMasked = account.teacher_public_name_masked;
    }
    if (account.avatar_key !== undefined) {
      user.avatarKey = typeof account.avatar_key === 'string' ? account.avatar_key : null;
    }
    if (account.teacher_phone !== undefined) {
      user.teacherPhone = typeof account.teacher_phone === 'string' ? account.teacher_phone.slice(0, 32) : null;
    }
    if (account.teacher_title !== undefined) {
      user.teacherTitle = typeof account.teacher_title === 'string' ? account.teacher_title.slice(0, 64) : null;
    }
    if (account.teacher_subject_ids !== undefined) {
      user.teacherSubjectIds = Array.isArray(account.teacher_subject_ids)
        ? (account.teacher_subject_ids as string[])
        : null;
    }
    if (account.evrak_defaults !== undefined && account.evrak_defaults !== null) {
      if (typeof account.evrak_defaults === 'object') {
        user.evrakDefaults = JSON.parse(JSON.stringify(account.evrak_defaults)) as Record<string, unknown>;
      }
    } else if (account.evrak_defaults === null) {
      user.evrakDefaults = null;
    }
    await this.userRepo.save(user);
  }

  private async assertTeacherSchoolApproveAllowed(user: User): Promise<void> {
    if (!user.school_id) {
      throw new BadRequestException({ code: 'NO_SCHOOL', message: 'Okul atanmamış.' });
    }
    if (!user.schoolJoinEmailVerifiedAt) {
      throw new BadRequestException({
        code: 'SCHOOL_JOIN_EMAIL_NOT_VERIFIED',
        message: 'E-posta doğrulanmadan onay verilemez.',
      });
    }
  }

  async setTeacherSchoolMembershipAction(
    targetUserId: string,
    action: 'approve' | 'reject' | 'revoke',
    scope: { role: UserRole; schoolId: string | null },
  ): Promise<User> {
    const isSuper = scope.role === UserRole.superadmin;
    const isSchoolAdmin = scope.role === UserRole.school_admin && !!scope.schoolId;
    if (!isSuper && !isSchoolAdmin) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Okul üyeliği onayı yalnızca süper yönetici veya ilgili okul yöneticisi tarafından yapılabilir.',
      });
    }
    const user = await this.findById(targetUserId);
    if (user.role !== UserRole.teacher) {
      throw new BadRequestException({ code: 'INVALID_ROLE', message: 'Sadece öğretmen hesapları onaylanabilir.' });
    }
    if (!user.school_id) {
      throw new BadRequestException({ code: 'NO_SCHOOL', message: 'Kullanıcının bağlı okulu yok.' });
    }
    if (isSchoolAdmin && user.school_id !== scope.schoolId) {
      throw new ForbiddenException({ code: 'SCOPE_VIOLATION', message: 'Bu öğretmen sizin okulunuza ait değil.' });
    }
    const eff = effectiveTeacherSchoolMembership(user);
    if (action === 'revoke') {
      if (!isSuper && !isSchoolAdmin) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: 'Onay geri alma yalnızca okul yöneticisi veya süper yönetici tarafından yapılabilir.',
        });
      }
      if (eff !== TeacherSchoolMembershipStatus.approved) {
        throw new BadRequestException({
          code: 'NOT_APPROVED',
          message: 'Yalnızca onaylı öğretmen için onay geri alınabilir.',
        });
      }
      user.teacherSchoolMembership = TeacherSchoolMembershipStatus.pending;
      return this.userRepo.save(user);
    }
    if (eff !== TeacherSchoolMembershipStatus.pending) {
      throw new BadRequestException({
        code: 'NOT_PENDING',
        message: 'Bu öğretmenin onay bekleyen okul başvurusu yok.',
      });
    }
    let rejectSchoolName: string | null = null;
    if (action === 'approve') {
      await this.assertTeacherSchoolApproveAllowed(user);
      user.teacherSchoolMembership = TeacherSchoolMembershipStatus.approved;
    } else {
      rejectSchoolName = user.school?.name ?? (await this.schoolsService.findById(user.school_id)).name;
      user.school_id = null;
      user.teacherSchoolMembership = TeacherSchoolMembershipStatus.rejected;
      user.schoolJoinEmailToken = null;
      user.schoolJoinEmailTokenExpiresAt = null;
      user.schoolJoinEmailVerifiedAt = null;
    }
    const saved = await this.userRepo.save(user);
    const greet = saved.display_name?.trim() || saved.email.split('@')[0] || 'Merhaba';
    if (action === 'approve' && saved.school_id) {
      const schoolName = user.school?.name ?? (await this.schoolsService.findById(saved.school_id)).name;
      void this.mailService
        .sendTeacherSchoolApprovedEmail(saved.email, { schoolName, recipientName: greet })
        .catch(() => {});
    } else if (action === 'reject' && rejectSchoolName) {
      void this.mailService
        .sendTeacherSchoolRejectedEmail(saved.email, { schoolName: rejectSchoolName, recipientName: greet })
        .catch(() => {});
    }
    return saved;
  }

  /** KVKK Madde 11: Kullanıcının verilerini JSON olarak döndürür. */
  async exportUserData(userId: string): Promise<Record<string, unknown>> {
    const user = await this.findById(userId);
    const school = user.school
      ? {
          id: user.school.id,
          name: user.school.name,
          principalName: user.school.principalName ?? null,
          type: user.school.type,
          segment: user.school.segment ?? null,
          city: user.school.city ?? null,
          district: user.school.district ?? null,
          status: user.school.status,
        }
      : null;
    return {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      role: user.role,
      school_id: user.school_id,
      teacher_school_membership: effectiveTeacherSchoolMembership(user),
      teacher_public_name_masked: user.teacherPublicNameMasked,
      school,
      status: user.status,
      teacher_branch: user.teacherBranch,
      teacher_phone: user.teacherPhone,
      teacher_title: user.teacherTitle,
      avatar_url: user.avatarUrl,
      avatar_key: user.avatarKey,
      teacher_subject_ids: user.teacherSubjectIds,
      evrak_defaults: user.evrakDefaults,
      moderator_modules: user.moderatorModules,
      created_at: user.created_at,
      updated_at: user.updated_at,
      exported_at: new Date().toISOString(),
    };
  }

  /** KVKK Madde 11: Hesabı devre dışı bırakır ve kişisel verileri anonimleştirir. */
  async deleteAccount(userId: string, currentPassword?: string | null): Promise<void> {
    const user = await this.findById(userId);
    if (user.passwordHash) {
      const pwd = currentPassword?.trim();
      if (!pwd) {
        throw new BadRequestException({
          code: 'PASSWORD_REQUIRED',
          message: 'Hesabı kapatmak için mevcut şifrenizi girin.',
        });
      }
      const ok = await bcrypt.compare(pwd, user.passwordHash);
      if (!ok) {
        throw new BadRequestException({ code: 'INVALID_PASSWORD', message: 'Şifre hatalı.' });
      }
    }
    await this.teacherAgendaImportService.deleteAllUserAgendaData(userId);
    user.status = UserStatus.deleted;
    user.display_name = null;
    user.passwordHash = null;
    user.firebaseUid = null;
    user.email = `deleted-${user.id}@deleted.local`;
    user.school_id = null;
    user.teacherSchoolMembership = TeacherSchoolMembershipStatus.none;
    user.teacherBranch = null;
    user.teacherPhone = null;
    user.teacherTitle = null;
    user.avatarUrl = null;
    user.avatarKey = null;
    user.teacherSubjectIds = null;
    user.evrakDefaults = null;
    user.moderatorModules = null;
    await this.userRepo.save(user);
  }

  /** Mevcut şifre doğrulanıp yeni şifre hash'lenerek kaydedilir. Sadece password_hash set edilmiş kullanıcılar için. */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.findById(userId);
    if (!user.passwordHash) {
      throw new BadRequestException({
        code: 'NO_PASSWORD',
        message: 'Bu hesap şifre ile giriş yapmıyor; şifre değiştirilemez.',
      });
    }
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) {
      throw new BadRequestException({
        code: 'INVALID_PASSWORD',
        message: 'Mevcut şifre hatalı.',
      });
    }
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await this.userRepo.save(user);
  }

  /**
   * Okul yöneticisi: şifresiz ön kayıt (stub) ile aynı ad-soyadlı web kayıtlı öğretmeni tek hesapta birleştirir.
   * Kayıt akışındaki otomatik birleştirme ile aynı kurallar (ad eşleşmesi, tek stub).
   */
  async mergeTeacherRegistration(
    stubUserId: string,
    registeredEmail: string,
    scope: { role: UserRole; schoolId: string | null },
  ): Promise<User> {
    if (scope.role !== UserRole.school_admin || !scope.schoolId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Bu işlem yalnızca okul yöneticisi tarafından yapılabilir.',
      });
    }
    const schoolId = scope.schoolId;
    const emailNorm = registeredEmail.trim().toLowerCase();
    const stub = await this.userRepo.findOne({ where: { id: stubUserId } });
    const registered = await this.userRepo.findOne({ where: { email: emailNorm } });
    if (!stub || stub.role !== UserRole.teacher || stub.school_id !== schoolId) {
      throw new BadRequestException({ code: 'INVALID_STUB', message: 'Geçersiz ön kayıt (öğretmen).' });
    }
    if (stub.passwordHash || stub.firebaseUid) {
      throw new BadRequestException({
        code: 'NOT_PASSWORDLESS_STUB',
        message: 'Bu kayıt zaten şifre veya sosyal giriş ile bağlı; birleştirme yapılamaz.',
      });
    }
    if (!registered || registered.role !== UserRole.teacher || registered.school_id !== schoolId) {
      throw new BadRequestException({
        code: 'INVALID_REGISTERED',
        message: 'Bu e-posta ile aynı okulda kayıtlı öğretmen bulunamadı.',
      });
    }
    if (registered.id === stub.id) {
      throw new BadRequestException({ code: 'SAME_USER', message: 'Aynı kullanıcı.' });
    }
    if (!registered.passwordHash) {
      throw new BadRequestException({
        code: 'REGISTERED_HAS_NO_PASSWORD',
        message: 'Seçilen hesapta yerel şifre yok; birleştirme için web ile kayıtlı hesap gerekir.',
      });
    }
    const nStub = normalizeTeacherDisplayName(stub.display_name);
    const nReg = normalizeTeacherDisplayName(registered.display_name);
    if (!nStub || nStub !== nReg) {
      throw new BadRequestException({
        code: 'NAME_MISMATCH',
        message: 'Ad-soyad eşleşmiyor. Ön kayıt ile web hesabındaki görünen ad aynı olmalıdır.',
      });
    }
    const otherStubs = await this.userRepo.find({
      where: { school_id: schoolId, role: UserRole.teacher },
    });
    const sameNameStubs = otherStubs.filter(
      (u) =>
        u.id !== stub.id &&
        !u.passwordHash &&
        !u.firebaseUid &&
        normalizeTeacherDisplayName(u.display_name) === nStub,
    );
    if (sameNameStubs.length > 0) {
      throw new BadRequestException({
        code: 'AMBIGUOUS_NAME_MERGE',
        message: 'Aynı adda başka ön kayıt var; önce fazlalıkları kaldırın.',
      });
    }

    stub.email = registered.email;
    stub.passwordHash = registered.passwordHash;
    stub.firebaseUid = registered.firebaseUid;
    stub.emailVerifiedAt = registered.emailVerifiedAt;
    stub.display_name = registered.display_name?.trim() || stub.display_name;
    if (!stub.teacherBranch && registered.teacherBranch) stub.teacherBranch = registered.teacherBranch;
    if (!stub.teacherPhone && registered.teacherPhone) stub.teacherPhone = registered.teacherPhone;
    if (!stub.teacherTitle && registered.teacherTitle) stub.teacherTitle = registered.teacherTitle;
    if (!stub.avatarUrl && registered.avatarUrl) stub.avatarUrl = registered.avatarUrl;
    if (!stub.avatarKey && registered.avatarKey) stub.avatarKey = registered.avatarKey;
    stub.teacherSchoolMembership = registered.teacherSchoolMembership;
    stub.schoolJoinEmailVerifiedAt = registered.schoolJoinEmailVerifiedAt;
    stub.schoolJoinEmailToken = registered.schoolJoinEmailToken;
    stub.schoolJoinEmailTokenExpiresAt = registered.schoolJoinEmailTokenExpiresAt;

    await this.userRepo.manager.transaction(async (em) => {
      await em.save(stub);
      await em.delete(User, { id: registered.id });
    });
    return this.findById(stub.id);
  }
}
