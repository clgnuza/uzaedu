import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../types/enums';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TicketModule } from './entities/ticket-module.entity';
import { IsString, IsIn, IsBoolean, IsOptional, IsInt } from 'class-validator';

class CreateModuleDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  icon_key?: string;

  @IsString()
  @IsIn(['SCHOOL_ONLY', 'PLATFORM_ONLY', 'BOTH'])
  target_availability!: 'SCHOOL_ONLY' | 'PLATFORM_ONLY' | 'BOTH';

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsInt()
  sort_order?: number;
}

class UpdateModuleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  icon_key?: string;

  @IsOptional()
  @IsString()
  @IsIn(['SCHOOL_ONLY', 'PLATFORM_ONLY', 'BOTH'])
  target_availability?: 'SCHOOL_ONLY' | 'PLATFORM_ONLY' | 'BOTH';

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsInt()
  sort_order?: number;
}

@Controller('ticket-modules')
@UseGuards(JwtAuthGuard)
export class TicketModulesController {
  constructor(
    @InjectRepository(TicketModule)
    private readonly moduleRepo: Repository<TicketModule>,
  ) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin, UserRole.moderator, UserRole.superadmin)
  async list(@Query('target_type') targetType?: 'SCHOOL_SUPPORT' | 'PLATFORM_SUPPORT') {
    const qb = this.moduleRepo
      .createQueryBuilder('m')
      .where('m.is_active = :active', { active: true })
      .orderBy('m.sort_order', 'ASC')
      .addOrderBy('m.name', 'ASC');
    if (targetType === 'SCHOOL_SUPPORT') {
      qb.andWhere("(m.target_availability = 'SCHOOL_ONLY' OR m.target_availability = 'BOTH')");
    } else if (targetType === 'PLATFORM_SUPPORT') {
      qb.andWhere("(m.target_availability = 'PLATFORM_ONLY' OR m.target_availability = 'BOTH')");
    }
    return qb.getMany();
  }

  /** Superadmin: tüm modüller (pasif dahil) */
  @Get('admin')
  @UseGuards(RolesGuard)
  @Roles(UserRole.superadmin)
  async listAll() {
    return this.moduleRepo
      .createQueryBuilder('m')
      .orderBy('m.sort_order', 'ASC')
      .addOrderBy('m.name', 'ASC')
      .getMany();
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.superadmin)
  async create(@Body() dto: CreateModuleDto) {
    const mod = this.moduleRepo.create({
      name: dto.name,
      icon_key: dto.icon_key ?? 'help-circle',
      target_availability: dto.target_availability,
      is_active: dto.is_active ?? true,
      sort_order: dto.sort_order ?? 0,
    });
    return this.moduleRepo.save(mod);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.superadmin)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateModuleDto,
  ) {
    const mod = await this.moduleRepo.findOne({ where: { id } });
    if (!mod) {
      throw new (await import('@nestjs/common').then((m) => m.NotFoundException))({
        code: 'NOT_FOUND',
        message: 'Modül bulunamadı.',
      });
    }
    if (dto.name !== undefined) mod.name = dto.name;
    if (dto.icon_key !== undefined) mod.icon_key = dto.icon_key;
    if (dto.target_availability !== undefined) mod.target_availability = dto.target_availability;
    if (dto.is_active !== undefined) mod.is_active = dto.is_active;
    if (dto.sort_order !== undefined) mod.sort_order = dto.sort_order;
    return this.moduleRepo.save(mod);
  }
}
