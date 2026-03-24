import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../types/enums';
import { AppConfigService } from '../app-config/app-config.service';
import { UploadService } from './upload.service';

class PresignDto {
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  filename!: string;

  @IsString()
  contentType!: string;

  @IsString()
  @IsIn(['announcement', 'school_logo', 'school_welcome', 'special_day', 'admin_message', 'document_template', 'ticket_attachment', 'agenda_note'])
  purpose!: string;
}

@Controller('upload')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.teacher, UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
export class UploadController {
  constructor(
    private readonly upload: UploadService,
    private readonly appConfig: AppConfigService,
  ) {}

  @Get('limits')
  async getLimits() {
    const limits = await this.appConfig.getUploadLimits();
    return {
      max_size_mb: limits.maxSizeBytes / (1024 * 1024),
      allowed_types: limits.allowedTypes,
    };
  }

  @Post('presign')
  async presign(@Body() dto: PresignDto) {
    return this.upload.getPresignedUploadUrl(dto.filename, dto.contentType, dto.purpose);
  }
}
