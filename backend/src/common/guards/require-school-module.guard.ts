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
import { BYPASS_SCHOOL_MODULE_GUARD_KEY } from '../decorators/bypass-school-module.decorator';

@Injectable()
export class RequireSchoolModuleGuard implements CanActivate {
  private static readonly MODULES_CACHE_MS = 60_000;
  private static modulesCache = new Map<string, { at: number; mods: string[] | null }>();

  constructor(
    private reflector: Reflector,
    @InjectRepository(School)
    private readonly schoolRepo: Repository<School>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const bypass = this.reflector.getAllAndOverride<boolean>(BYPASS_SCHOOL_MODULE_GUARD_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (bypass) return true;

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

    const mods = await this.getEnabledModules(user.school_id);
    if (!mods || mods.length === 0) return true; // null/empty = tüm modüller açık
    if (anyModuleKeys?.length) {
      if (anyModuleKeys.some((k) => mods.includes(k))) return true;
      throw new ForbiddenException({
        code: 'MODULE_DISABLED',
        message: 'Bu işlem için okulda Evrak & Plan veya Bilsem modülünden en az biri açık olmalıdır.',
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
      bilsem: 'Bu okulda Bilsem modülü kapalı.',
      extra_lesson: 'Bu okulda Ek Ders modülü kapalı.',
      butterfly_exam: 'Bu okulda Kertenkele Sınav modülü kapalı.',
      dogrudan_temin: 'Bu okulda Doğrudan Temin modülü kapalı.',
      ders_dagit: 'Bu okulda DersDağıt modülü kapalı.',
    };
    const message = messages[moduleKey] ?? 'Bu okulda bu modül kapalı.';
    throw new ForbiddenException({ code: 'MODULE_DISABLED', message });
  }

  private async getEnabledModules(schoolId: string): Promise<string[] | null> {
    const hit = RequireSchoolModuleGuard.modulesCache.get(schoolId);
    if (hit && Date.now() - hit.at < RequireSchoolModuleGuard.MODULES_CACHE_MS) {
      return hit.mods;
    }
    const school = await this.schoolRepo.findOne({
      where: { id: schoolId },
      select: ['enabled_modules'],
    });
    const mods = school?.enabled_modules ?? null;
    RequireSchoolModuleGuard.modulesCache.set(schoolId, { at: Date.now(), mods });
    return mods;
  }
}
