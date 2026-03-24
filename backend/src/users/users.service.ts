import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly schoolsService: SchoolsService,
    private readonly teacherAgendaImportService: TeacherAgendaImportService,
  ) {}

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
    } else if (
      scope.role === UserRole.school_admin &&
      dto.role === UserRole.teacher &&
      scope.schoolId
    ) {
      qb.orderBy(
        `CASE WHEN (u.teacher_school_membership = :_sap OR (u.teacher_school_membership = :_snone AND u.school_id IS NOT NULL AND u.role = :_str)) THEN 1 ELSE 0 END`,
        'ASC',
      )
        .addOrderBy('u.created_at', 'DESC')
        .setParameter('_sap', TeacherSchoolMembershipStatus.approved)
        .setParameter('_snone', TeacherSchoolMembershipStatus.none)
        .setParameter('_str', UserRole.teacher);
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

  async create(dto: CreateUserDto, scopeSchoolId: string | null): Promise<User> {
    if (scopeSchoolId !== null) dto.school_id = scopeSchoolId;
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
      user.school_id = dto.school_id;
      if (user.role === UserRole.teacher) {
        user.teacherSchoolMembership = dto.school_id
          ? TeacherSchoolMembershipStatus.approved
          : TeacherSchoolMembershipStatus.none;
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
      if (scope.role !== UserRole.superadmin) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: 'Okul üyeliği durumu yalnızca süper yönetici tarafından ayarlanabilir.',
        });
      }
      if (user.role !== UserRole.teacher) {
        throw new BadRequestException({ code: 'INVALID_ROLE', message: 'Sadece öğretmen hesapları için geçerlidir.' });
      }
      user.teacherSchoolMembership = dto.teacher_school_membership;
    }
    return this.userRepo.save(user);
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
        } else {
          user.school_id = null;
          user.teacherSchoolMembership = TeacherSchoolMembershipStatus.none;
        }
      }
    }
    if (dto.teacher_public_name_masked !== undefined) {
      user.teacherPublicNameMasked = dto.teacher_public_name_masked;
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
    return this.userRepo.save(user);
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

  async setTeacherSchoolMembershipAction(
    targetUserId: string,
    action: 'approve' | 'reject' | 'revoke',
    scope: { role: UserRole; schoolId: string | null },
  ): Promise<User> {
    if (scope.role !== UserRole.school_admin || !scope.schoolId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    }
    const user = await this.findById(targetUserId);
    if (user.role !== UserRole.teacher) {
      throw new BadRequestException({ code: 'INVALID_ROLE', message: 'Sadece öğretmen hesapları onaylanabilir.' });
    }
    if (user.school_id !== scope.schoolId) {
      throw new ForbiddenException({ code: 'SCOPE_VIOLATION', message: 'Bu kullanıcı sizin okulunuza bağlı değil.' });
    }
    const eff = effectiveTeacherSchoolMembership(user);
    if (action === 'revoke') {
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
    if (action === 'approve') {
      user.teacherSchoolMembership = TeacherSchoolMembershipStatus.approved;
    } else {
      user.school_id = null;
      user.teacherSchoolMembership = TeacherSchoolMembershipStatus.rejected;
    }
    return this.userRepo.save(user);
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
}
