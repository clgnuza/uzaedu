import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { SchoolsService } from './schools.service';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { UserRole } from '../types/enums';
import { CreateSchoolDto } from './dto/create-school.dto';
import { BulkCreateSchoolDto } from './dto/bulk-create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import { ListSchoolsDto } from './dto/list-schools.dto';
import { BulkSchoolModuleDto } from './dto/bulk-school-module.dto';
import { ReconcilePreviewDto, ReconcileApplyDto } from './dto/reconcile-schools.dto';
import { MebbisKurumlistesiService } from './mebbis-kurumlistesi.service';
import { MebbisFetchDto, MebbisIlceQueryDto } from './dto/mebbis-fetch.dto';

@Controller('schools')
@UseGuards(JwtAuthGuard)
export class SchoolsController {
  constructor(
    private readonly schoolsService: SchoolsService,
    private readonly mebbisKurumlistesi: MebbisKurumlistesiService,
  ) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.superadmin, UserRole.school_admin, UserRole.moderator, UserRole.teacher)
  @RequireModule('schools')
  async list(@Query() dto: ListSchoolsDto, @CurrentUser() payload: CurrentUserPayload) {
    const scope = { role: payload.user.role as UserRole, schoolId: payload.schoolId };
    return this.schoolsService.list(dto, scope);
  }

  @Get('mebbis/il-options')
  @UseGuards(RolesGuard)
  @Roles(UserRole.superadmin)
  mebbisIlOptions() {
    return this.mebbisKurumlistesi.getIlOptions();
  }

  @Post('mebbis/ilce-options')
  @UseGuards(RolesGuard)
  @Roles(UserRole.superadmin)
  mebbisIlceOptions(@Body() dto: MebbisIlceQueryDto) {
    return this.mebbisKurumlistesi.getIlceOptions(dto);
  }

  @Post('mebbis/fetch-rows')
  @UseGuards(RolesGuard)
  @Roles(UserRole.superadmin)
  mebbisFetchRows(@Body() dto: MebbisFetchDto) {
    return this.mebbisKurumlistesi.fetchSchools(dto);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.superadmin, UserRole.school_admin, UserRole.moderator)
  @RequireModule('schools')
  async getById(@Param('id') id: string, @CurrentUser() payload: CurrentUserPayload) {
    const school = await this.schoolsService.findById(id);
    const role = payload.user.role as UserRole;
    if (role === UserRole.school_admin && school.id !== payload.schoolId) {
      const { ForbiddenException } = await import('@nestjs/common');
      throw new ForbiddenException({ code: 'SCOPE_VIOLATION', message: 'Bu veriye erişim yetkiniz yok.' });
    }
    return school;
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.superadmin)
  async create(@Body() dto: CreateSchoolDto, @CurrentUser() payload: CurrentUserPayload) {
    return this.schoolsService.create(dto, payload.userId);
  }

  @Post('bulk')
  @UseGuards(RolesGuard)
  @Roles(UserRole.superadmin)
  async bulkCreate(@Body() dto: BulkCreateSchoolDto, @CurrentUser() payload: CurrentUserPayload) {
    return this.schoolsService.bulkCreate(dto, payload.userId);
  }

  @Post('reconcile/preview')
  @UseGuards(RolesGuard)
  @Roles(UserRole.superadmin)
  async reconcilePreview(@Body() dto: ReconcilePreviewDto) {
    return this.schoolsService.reconcilePreview(dto.schools);
  }

  @Post('reconcile/apply')
  @UseGuards(RolesGuard)
  @Roles(UserRole.superadmin)
  async reconcileApply(@Body() dto: ReconcileApplyDto, @CurrentUser() payload: CurrentUserPayload) {
    return this.schoolsService.reconcileApply(dto, payload.userId);
  }

  @Patch('bulk-enabled-modules')
  @UseGuards(RolesGuard)
  @Roles(UserRole.superadmin)
  async bulkEnabledModules(@Body() dto: BulkSchoolModuleDto, @CurrentUser() payload: CurrentUserPayload) {
    return this.schoolsService.bulkToggleEnabledModuleForAllSchools(dto.module_key, dto.enable, payload.userId);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.superadmin, UserRole.school_admin)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSchoolDto,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    const scope = { role: payload.user.role as UserRole, schoolId: payload.schoolId, userId: payload.userId };
    return this.schoolsService.update(id, dto, scope);
  }
}
