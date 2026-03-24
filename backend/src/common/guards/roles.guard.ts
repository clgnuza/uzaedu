import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../types/enums';
import { User } from '../../users/entities/user.entity';
import { REQUIRE_MODULE_KEY } from '../decorators/require-module.decorator';

export const ROLES_KEY = 'roles';

/** AUTHORITY_MATRIX: route bazında allowed_roles kontrolü. Moderator için modül yetkisi de kontrol edilir. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles?.length) return true;

    const request = context.switchToHttp().getRequest<{ user?: User }>();
    const user = request.user as User | undefined;
    if (!user) return false;

    if (!requiredRoles.includes(user.role)) return false;

    if (user.role === UserRole.superadmin) return true;

    if (user.role === UserRole.moderator) {
      const requiredModule = this.reflector.getAllAndOverride<string>(REQUIRE_MODULE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (!requiredModule) return true;
      const modules = user.moderatorModules ?? [];
      return Array.isArray(modules) && modules.includes(requiredModule);
    }

    return true;
  }
}
