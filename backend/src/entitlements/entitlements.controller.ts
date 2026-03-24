import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../types/enums';
import { EntitlementService } from './entitlement.service';

@Controller('entitlements')
export class EntitlementsController {
  constructor(private readonly entitlementService: EntitlementService) {}

  /** Kullanıcının haklarını listele */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  async list(@CurrentUser() payload: { user: { id: string } }) {
    return this.entitlementService.findAllForUser(payload.user.id);
  }
}
