import { Controller, Post, Get, Body, HttpCode, HttpStatus, BadRequestException, Req, Query, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { AuditService } from '../audit/audit.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { FirebaseTokenDto } from './dto/firebase-token.dto';
import { SchoolsService } from '../schools/schools.service';
import { User } from '../users/entities/user.entity';
import { TeacherSchoolMembershipStatus } from '../types/enums';
import { effectiveTeacherSchoolMembership } from '../common/utils/teacher-school-membership';
import { clearSessionCookie, setSessionCookie } from './auth-cookie';

function toUserResponse(user: User) {
  const eff = effectiveTeacherSchoolMembership(user);
  return {
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    role: user.role,
    school_id: user.school_id,
    school: user.school ? { id: user.school.id, name: user.school.name } : null,
    teacher_school_membership: eff,
    school_verified: eff === TeacherSchoolMembershipStatus.approved && !!user.school_id,
    teacher_public_name_masked: user.teacherPublicNameMasked,
  };
}

function getClientIp(req: Request): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = req.ip ?? (Array.isArray(forwarded) ? forwarded[0] : forwarded);
  return (typeof ip === 'string' ? ip : null) ?? null;
}

@Controller('auth')
@Throttle({ auth: { limit: 30, ttl: 60000 } })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly auditService: AuditService,
    private readonly schoolsService: SchoolsService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      const { token, user } = await this.authService.login(dto.email, dto.password);
      setSessionCookie(res, token);
      await this.auditService.log({
        action: 'login',
        userId: user.id,
        schoolId: user.school_id,
        ip: getClientIp(req),
      });
      return { token, user: toUserResponse(user) };
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'status' in e && (e as { status: number }).status === 401) {
        const schoolId = await this.authService.getSchoolIdForAudit(dto.email);
        await this.auditService.log({
          action: 'failed_login',
          schoolId,
          ip: getClientIp(req),
          meta: { reason: 'wrong_password' },
        });
      }
      throw e;
    }
  }

  @Post('register')
  @Throttle({ auth: { limit: 15, ttl: 60000 } })
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    if (!dto.consent_terms) {
      throw new BadRequestException({
        code: 'CONSENT_REQUIRED',
        message: 'Gizlilik politikası ve kullanım şartlarını kabul etmelisiniz.',
      });
    }
    const { token, user } = await this.authService.register(
      dto.email,
      dto.password,
      dto.display_name,
      dto.school_id ?? null,
      dto.invite_code ?? null,
    );
    setSessionCookie(res, token);
    return { token, user: toUserResponse(user) };
  }

  @Get('register-schools')
  @Throttle({ public: { limit: 120, ttl: 60000 } })
  async registerSchools(@Query('q') q: string, @Query('limit') limit: string) {
    const lim = Math.min(40, Math.max(1, parseInt(limit || '20', 10) || 20));
    return this.schoolsService.listForRegister(q?.trim() ?? '', lim);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.new_password);
  }

  @Post('firebase-token')
  @HttpCode(HttpStatus.OK)
  async firebaseToken(@Body() dto: FirebaseTokenDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { token, user } = await this.authService.exchangeFirebaseToken(dto.id_token);
    setSessionCookie(res, token);
    await this.auditService.log({
      action: 'login',
      userId: user.id,
      schoolId: user.school_id,
      ip: getClientIp(req),
      meta: { provider: 'firebase' },
    });
    return { token, user: toUserResponse(user) };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response) {
    clearSessionCookie(res);
    return { ok: true };
  }
}
