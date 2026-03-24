import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { UserRole } from '../types/enums';
import { ContentService } from './content.service';
import { ListContentItemsDto } from './dto/list-content-items.dto';
import { UsersService } from '../users/users.service';
import { normalizeCityForMebFilter } from './city-normalize';

/** Son kullanıcı: teacher, school_admin. Superadmin önizleme için. Yönlendirme harici URL; sunucu yükü yok. */
@Controller('content')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.teacher, UserRole.school_admin, UserRole.superadmin)
export class ContentController {
  constructor(
    private readonly contentService: ContentService,
    private readonly usersService: UsersService,
  ) {}

  @Get('channels')
  getChannels() {
    return this.contentService.getChannels();
  }

  @Get('meb-sources')
  getMebSources() {
    return this.contentService.getMebSources();
  }

  @Get('items')
  async listItems(@Query() dto: ListContentItemsDto, @CurrentUser() payload: CurrentUserPayload) {
    if (!dto.city && (payload.role === UserRole.teacher || payload.role === UserRole.school_admin)) {
      const user = await this.usersService.findById(payload.userId);
      if (user.school?.city) {
        const normalized = normalizeCityForMebFilter(user.school.city);
        if (normalized) dto = { ...dto, city: normalized };
      }
    }
    return this.contentService.listItems(dto);
  }

  @Get('items/:id')
  getItem(@Param('id') id: string) {
    return this.contentService.getItemById(id);
  }
}
