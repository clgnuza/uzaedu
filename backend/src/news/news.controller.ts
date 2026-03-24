import { Controller, Get, Param, Query, UseGuards, NotFoundException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../types/enums';
import { PaginationDto } from '../common/dtos/pagination.dto';

/** WP genel haber feed – şu an stub; WP entegrasyonu sonra eklenir */
@Controller('news')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.teacher)
export class NewsController {
  @Get()
  list(@Query() dto: PaginationDto) {
    return { total: 0, page: dto.page ?? 1, limit: dto.limit ?? 20, items: [] };
  }

  @Get(':id')
  get(@Param('id') _id: string) {
    throw new NotFoundException({ code: 'NOT_FOUND', message: 'İstediğiniz kayıt bulunamadı.' });
  }
}
