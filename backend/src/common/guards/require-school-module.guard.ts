import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { School } from '../../schools/entities/school.entity';
import { UserRole } from '../../types/enums';
import {
  REQUIRE_ANY_SCHOOL_MODULES_KEY,
  REQUIRE_SCHOOL_MODULE_KEY,
} from '../decorators/require-school-module.decorator';

@Injectable()
export class RequireSchoolModuleGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectRepository(School)
    private readonly schoolRepo: Repository<School>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const moduleKey = this.reflector.getAllAndOverride<string>(REQUIRE_SCHOOL_MODULE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const anyModuleKeys = this.reflector.getAllAndOverride<string[]>(REQUIRE_ANY_SCHOOL_MODULES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!moduleKey && (!anyModuleKeys || anyModuleKeys.length === 0)) return true;

    const request = context.switchToHttp().getRequest<{ user?: { role: string; school_id?: string | null } }>();
    const user = request.user;
    if (!user) return false;

    if (user.role === UserRole.superadmin || user.role === UserRole.moderator) return true;
    if (!user.school_id) return true;

    const school = await this.schoolRepo.findOne({
      where: { id: user.school_id },
      select: ['enabled_modules'],
    });
    if (!school) return true;

    const mods = school.enabled_modules;
    if (!mods || mods.length === 0) return true; // null/empty = tüm modüller açık
    if (anyModuleKeys?.length) {
      if (anyModuleKeys.some((k) => mods.includes(k))) return true;
      throw new ForbiddenException({
        code: 'MODULE_DISABLED',
        message: 'Bu işlem için okulda Evrak & Plan veya BİLSEM modülünden en az biri açık olmalıdır.',
      });
    }
    if (moduleKey && mods.includes(moduleKey)) return true;

    const messages: Record<string, string> = {
      school_reviews: 'Bu okulda Okul Değerlendirme modülü kapalı.',
      duty: 'Bu okulda Nöbet modülü kapalı.',
      tv: 'Bu okulda Duyuru TV modülü kapalı.',
      document: 'Bu okulda Evrak & Plan modülü kapalı.',
      outcome: 'Bu okulda Kazanım Takip modülü kapalı.',
      optical: 'Bu okulda Optik Okuma modülü kapalı.',
      smart_board: 'Bu okulda Akıllı Tahta modülü kapalı.',
      teacher_agenda: 'Bu okulda Öğretmen Ajandası modülü kapalı.',
      bilsem: 'Bu okulda BİLSEM modülü kapalı.',
      extra_lesson: 'Bu okulda Ek Ders modülü kapalı.',
      school_profile: 'Bu okulda Okul Tanıtım modülü kapalı.',
    };
    const message = messages[moduleKey] ?? 'Bu okulda bu modül kapalı.';
    throw new ForbiddenException({ code: 'MODULE_DISABLED', message });
  }
}
