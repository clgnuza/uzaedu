import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  REQUIRE_ANY_SCHOOL_MODULES_KEY,
  REQUIRE_SCHOOL_MODULE_KEY,
} from '../../common/decorators/require-school-module.decorator';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../types/enums';
import type { MarketModuleKey } from '../../app-config/market-policy.defaults';
import { MarketModuleActivationService } from '../market-module-activation.service';

@Injectable()
export class RequireModuleActivationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly activation: MarketModuleActivationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user?: User }>();
    const user = request.user;
    if (!user) return false;
    if (user.role === UserRole.superadmin || user.role === UserRole.moderator) return true;

    const anyKeys = this.reflector.getAllAndOverride<string[]>(REQUIRE_ANY_SCHOOL_MODULES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (anyKeys?.length) {
      await this.activation.assertAnyActivatedOrThrow(user, anyKeys);
      return true;
    }
    const moduleKey = this.reflector.getAllAndOverride<string>(REQUIRE_SCHOOL_MODULE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!moduleKey) return true;
    await this.activation.assertActivatedOrThrow(user, moduleKey as MarketModuleKey);
    return true;
  }
}
