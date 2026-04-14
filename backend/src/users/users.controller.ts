import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { UserRole, TeacherSchoolMembershipStatus } from '../types/enums';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { TeacherSchoolMembershipActionDto } from './dto/teacher-school-membership-action.dto';
import { User } from './entities/user.entity';
import { effectiveTeacherSchoolMembership } from '../common/utils/teacher-school-membership';
import { schoolJoinStage } from '../common/utils/school-join-stage';

function toUserResponse(user: User) {
  const eff = effectiveTeacherSchoolMembership(user);
  return {
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    role: user.role,
    school_id: user.school_id,
    school: user.school ?? undefined,
    status: user.status,
    teacher_branch: user.teacherBranch ?? null,
    teacher_phone: user.teacherPhone ?? null,
    teacher_title: user.teacherTitle ?? null,
    avatar_url: user.avatarUrl ?? null,
    avatar_key: user.avatarKey ?? null,
    teacher_subject_ids: user.teacherSubjectIds ?? null,
    moderator_modules: user.moderatorModules ?? null,
    teacher_school_membership: eff,
    school_verified: eff === TeacherSchoolMembershipStatus.approved && !!user.school_id,
    teacher_public_name_masked: user.teacherPublicNameMasked,
    school_join_stage: schoolJoinStage(user),
    school_join_email_verified_at: user.schoolJoinEmailVerifiedAt?.toISOString() ?? null,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('school-join-queue')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin, UserRole.school_admin)
  async schoolJoinQueue(@CurrentUser() payload: CurrentUserPayload) {
    return this.usersService.listSchoolJoinQueue({
      role: payload.user.role as UserRole,
      schoolId: payload.schoolId,
    });
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin, UserRole.school_admin, UserRole.moderator)
  @RequireModule('users')
  async list(@Query() dto: ListUsersDto, @CurrentUser() payload: CurrentUserPayload) {
    const scope = { role: payload.user.role as UserRole, schoolId: payload.schoolId };
    const result = await this.usersService.list(dto, scope);
    return {
      ...result,
      items: result.items.map(toUserResponse),
    };
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin, UserRole.school_admin)
  async create(@Body() dto: CreateUserDto, @CurrentUser() payload: CurrentUserPayload) {
    const scopeSchoolId = payload.user.role === UserRole.school_admin ? payload.schoolId : null;
    return this.usersService.create(dto, scopeSchoolId);
  }

  @Post('import/mebbis-personnel')
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin)
  @RequireModule('users')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 8 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ok =
          file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
          file.mimetype === 'application/vnd.ms-excel' ||
          file.mimetype === 'application/octet-stream' ||
          file.originalname?.toLowerCase().endsWith('.xlsx') ||
          file.originalname?.toLowerCase().endsWith('.xls');
        cb(null, !!ok);
      },
    }),
  )
  async importMebbisPersonnel(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException({ code: 'NO_FILE', message: '.xls veya .xlsx dosyası yükleyin.' });
    }
    return this.usersService.importMebbisPersonnelXls(file.buffer, {
      role: payload.user.role as UserRole,
      schoolId: payload.schoolId,
    });
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin, UserRole.school_admin, UserRole.teacher, UserRole.moderator)
  @RequireModule('users')
  async getById(@Param('id') id: string, @CurrentUser() payload: CurrentUserPayload) {
    const user = await this.usersService.findById(id);
    const role = payload.user.role as UserRole;
    if (role === UserRole.teacher && user.id !== payload.userId) {
      const { ForbiddenException } = await import('@nestjs/common');
      throw new ForbiddenException({ code: 'SCOPE_VIOLATION', message: 'Bu veriye erişim yetkiniz yok.' });
    }
    if (role === UserRole.school_admin && user.school_id !== payload.schoolId) {
      const { ForbiddenException } = await import('@nestjs/common');
      throw new ForbiddenException({ code: 'SCOPE_VIOLATION', message: 'Bu veriye erişim yetkiniz yok.' });
    }
    return {
      ...toUserResponse(user),
      ...(role === UserRole.superadmin
        ? {
            market_jeton_balance: user.marketJetonBalance,
            market_ekders_balance: user.marketEkdersBalance,
          }
        : {}),
    };
  }

  @Patch(':id/teacher-school-membership')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin, UserRole.school_admin)
  async setTeacherSchoolMembership(
    @Param('id') id: string,
    @Body() dto: TeacherSchoolMembershipActionDto,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    const user = await this.usersService.setTeacherSchoolMembershipAction(id, dto.action, {
      role: payload.user.role as UserRole,
      schoolId: payload.schoolId,
    });
    return toUserResponse(user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin, UserRole.school_admin)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    const scope = {
      role: payload.user.role as UserRole,
      schoolId: payload.schoolId,
      userId: payload.userId,
    };
    return this.usersService.update(id, dto, scope);
  }
}
