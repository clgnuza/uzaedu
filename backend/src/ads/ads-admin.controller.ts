import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { UserRole } from '../types/enums';
import { AdsService } from './ads.service';
import { ListAdsDto } from './dto/list-ads.dto';
import { CreateAdDto } from './dto/create-ad.dto';
import { UpdateAdDto } from './dto/update-ad.dto';

@Controller('ads/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.superadmin)
export class AdsAdminController {
  constructor(private readonly ads: AdsService) {}

  @Get()
  list(@Query() dto: ListAdsDto) {
    return this.ads.listAdmin(dto);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.ads.findOneAdmin(id);
  }

  @Post()
  create(@Body() dto: CreateAdDto, @CurrentUser() payload: CurrentUserPayload) {
    return this.ads.create(dto, payload.userId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAdDto) {
    return this.ads.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.ads.remove(id);
    return { ok: true };
  }
}
