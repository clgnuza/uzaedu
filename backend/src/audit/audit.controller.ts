import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../types/enums';
import { AuditService } from './audit.service';
import { SchoolsService } from '../schools/schools.service';
import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

class ListAuditLogsDto {
  @IsString()
  school_id!: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.superadmin)
export class AuditController {
  constructor(
    private readonly auditService: AuditService,
    private readonly schoolsService: SchoolsService,
  ) {}

  @Get()
  async list(@Query() dto: ListAuditLogsDto) {
    if (!dto.school_id) {
      const { BadRequestException } = await import('@nestjs/common');
      throw new BadRequestException({ code: 'MISSING_PARAM', message: 'school_id zorunludur.' });
    }
    try {
      await this.schoolsService.findById(dto.school_id);
    } catch {
      const { NotFoundException } = await import('@nestjs/common');
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Okul bulunamadı.' });
    }
    return this.auditService.list({
      schoolId: dto.school_id,
      action: dto.action,
      from: dto.from,
      to: dto.to,
      page: dto.page,
      limit: dto.limit,
    });
  }
}
