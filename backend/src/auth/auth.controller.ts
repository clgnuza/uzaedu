import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Req,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { AuditService } from '../audit/audit.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ResetPasswordCodeDto } from './dto/reset-password-code.dto';
import { FirebaseTokenDto } from './dto/firebase-token.dto';
import { SchoolsService } from '../schools/schools.service';
import { User } from '../users/entities/user.entity';
import { SchoolType, TeacherSchoolMembershipStatus } from '../types/enums';
import { effectiveTeacherSchoolMembership } from '../common/utils/teacher-school-membership';
import { schoolJoinStage } from '../common/utils/school-join-stage';
import { clearSessionCookie, setSessionCookie } from './auth-cookie';
import { VerifySchoolEmailDto } from './dto/verify-school-email.dto';
import { EmailCodeDto } from './dto/email-code.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { RegisterSchoolDto } from './dto/register-school.dto';
import { VerifySchoolJoinBodyDto } from './dto/verify-school-join-body.dto';
import { JwtAuthGuard } from './guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

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
    school_join_stage: schoolJoinStage(user),
    school_join_email_verified_at: user.schoolJoinEmailVerifiedAt?.toISOString() ?? null,
    email_verified: !!user.emailVerifiedAt,
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

  /** Öğretmen / süperadmin / moderatör — şifre sonrası OTP (demo ortamında tek adım). */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      const step = await this.authService.teacherLoginStep(dto.email, dto.password);
      if ('token' in step) {
        setSessionCookie(res, step.token, { remember: dto.remember_me === true });
        await this.auditService.log({
          action: 'login',
          userId: step.user.id,
          schoolId: step.user.school_id,
          ip: getClientIp(req),
        });
        return { token: step.token, user: toUserResponse(step.user) };
      }
      return { needs_verification_code: true, email: step.email, otp_purpose: step.otp_purpose };
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

  @Post('teacher/login-verify')
  @HttpCode(HttpStatus.OK)
  async teacherLoginVerify(@Body() dto: EmailCodeDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { token, user } = await this.authService.teacherLoginVerify(dto.email, dto.code);
    setSessionCookie(res, token, { remember: dto.remember_me === true });
    await this.auditService.log({
      action: 'login',
      userId: user.id,
      schoolId: user.school_id,
      ip: getClientIp(req),
      meta: { step: 'otp' },
    });
    return { token, user: toUserResponse(user) };
  }

  @Post('school/login')
  @HttpCode(HttpStatus.OK)
  async schoolLogin(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      const step = await this.authService.schoolLoginStep(dto.email, dto.password);
      if ('token' in step) {
        setSessionCookie(res, step.token, { remember: dto.remember_me === true });
        await this.auditService.log({
          action: 'login',
          userId: step.user.id,
          schoolId: step.user.school_id,
          ip: getClientIp(req),
          meta: { portal: 'school' },
        });
        return { token: step.token, user: toUserResponse(step.user) };
      }
      return { needs_verification_code: true, email: step.email, otp_purpose: step.otp_purpose };
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'status' in e && (e as { status: number }).status === 401) {
        const schoolId = await this.authService.getSchoolIdForAudit(dto.email);
        await this.auditService.log({
          action: 'failed_login',
          schoolId,
          ip: getClientIp(req),
          meta: { reason: 'wrong_password', portal: 'school' },
        });
      }
      throw e;
    }
  }

  @Post('school/login-verify')
  @HttpCode(HttpStatus.OK)
  async schoolLoginVerify(@Body() dto: EmailCodeDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { token, user } = await this.authService.schoolLoginVerify(dto.email, dto.code);
    setSessionCookie(res, token, { remember: dto.remember_me === true });
    await this.auditService.log({
      action: 'login',
      userId: user.id,
      schoolId: user.school_id,
      ip: getClientIp(req),
      meta: { portal: 'school', step: 'otp' },
    });
    return { token, user: toUserResponse(user) };
  }

  @Get('school/lookup')
  @Throttle({ public: { limit: 60, ttl: 60000 } })
  async schoolLookup(@Query('institution_code') code: string) {
    if (!code?.trim()) {
      throw new BadRequestException({ code: 'INVALID', message: 'Kurum kodu gerekli.' });
    }
    return this.authService.lookupSchoolByInstitutionCode(code.trim());
  }

  @Post('school/register')
  @Throttle({ auth: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.CREATED)
  async schoolRegister(@Body() dto: RegisterSchoolDto) {
    if (!dto.consent_terms) {
      throw new BadRequestException({
        code: 'CONSENT_REQUIRED',
        message: 'Gizlilik politikası ve kullanım şartlarını kabul etmelisiniz.',
      });
    }
    return this.authService.registerSchoolAdmin(
      dto.institution_code,
      dto.email,
      dto.password,
      dto.display_name,
    );
  }

  @Post('school/register-verify')
  @HttpCode(HttpStatus.OK)
  async schoolRegisterVerify(@Body() dto: EmailCodeDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { token, user } = await this.authService.completeSchoolRegister(dto.email, dto.code);
    setSessionCookie(res, token);
    void this.auditService.log({
      action: 'register',
      userId: user.id,
      schoolId: user.school_id,
      ip: getClientIp(req),
      meta: { portal: 'school_admin' },
    });
    return { token, user: toUserResponse(user) };
  }

  @Post('register')
  @Throttle({ auth: { limit: 15, ttl: 60000 } })
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    if (!dto.consent_terms) {
      throw new BadRequestException({
        code: 'CONSENT_REQUIRED',
        message: 'Gizlilik politikası ve kullanım şartlarını kabul etmelisiniz.',
      });
    }
    const out = await this.authService.register(
      dto.email,
      dto.password,
      dto.display_name,
      dto.school_id ?? null,
      dto.invite_code ?? null,
    );
    void this.auditService.log({
      action: 'register_started',
      schoolId: null,
      ip: getClientIp(req),
      meta: { email: out.email, with_school: !!dto.school_id?.trim() },
    });
    return out;
  }

  @Post('register-verify')
  @HttpCode(HttpStatus.OK)
  async registerVerify(@Body() dto: EmailCodeDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { token, user, school_verify_email_sent } = await this.authService.completeTeacherRegister(dto.email, dto.code);
    setSessionCookie(res, token);
    void this.auditService.log({
      action: 'register',
      userId: user.id,
      schoolId: user.school_id,
      ip: getClientIp(req),
      meta: { with_school: !!user.school_id },
    });
    return {
      token,
      user: toUserResponse(user),
      ...(school_verify_email_sent !== undefined && { school_verify_email_sent }),
    };
  }

  @Post('resend-otp')
  @Throttle({ auth: { limit: 8, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendOtp(dto.email, dto.purpose);
  }

  @Post('verify-school-join')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async verifySchoolJoin(@CurrentUser('userId') userId: string, @Body() dto: VerifySchoolJoinBodyDto) {
    return this.authService.verifySchoolJoinCode(userId, dto.code);
  }

  @Get('register-schools')
  @Throttle({ public: { limit: 120, ttl: 60000 } })
  async registerSchools(
    @Query('q') q: string,
    @Query('limit') limit: string,
    @Query('city') city?: string,
    @Query('district') district?: string,
    @Query('type') typeRaw?: string,
  ) {
    const lim = Math.min(40, Math.max(1, parseInt(limit || '20', 10) || 20));
    const type =
      typeRaw && (Object.values(SchoolType) as string[]).includes(typeRaw) ? (typeRaw as SchoolType) : undefined;
    return this.schoolsService.listForRegister(q?.trim() ?? '', lim, {
      city: city?.trim() || undefined,
      district: district?.trim() || undefined,
      type,
    });
  }

  @Post('verify-school-email')
  @Throttle({ auth: { limit: 20, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async verifySchoolEmail(@Body() dto: VerifySchoolEmailDto) {
    return this.authService.verifySchoolJoinEmail(dto.token);
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

  @Post('reset-password-code')
  @HttpCode(HttpStatus.OK)
  async resetPasswordCode(@Body() dto: ResetPasswordCodeDto) {
    return this.authService.resetPasswordWithCode(dto.email, dto.code, dto.new_password);
  }

  @Post('firebase-token')
  @HttpCode(HttpStatus.OK)
  async firebaseToken(@Body() dto: FirebaseTokenDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { token, user } = await this.authService.exchangeFirebaseToken(dto.id_token);
    setSessionCookie(res, token, { remember: dto.remember_me === true });
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
