import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../types/enums';
import type { User } from '../users/entities/user.entity';
import { DeployService } from './deploy.service';

/** Yanıt süresini eşitlemek için (başarısız şifre denemelerinde zaman damgası sızıntısını zorlaştırır) */
const DEPLOY_MIN_RESPONSE_MS = 450;

class DeployRunDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  deploy_password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  /** DEPLOY_HEADER_TOKEN ile aynı; başlık X-Deploy-Token da kabul edilir */
  deploy_header_token?: string;
}

@Controller('deploy')
export class DeployController {
  constructor(private readonly deployService: DeployService) {}

  @Get('status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  getStatus() {
    return this.deployService.getStatus();
  }

  @Post('run')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  @Throttle({ default: { limit: 3, ttl: 3_600_000 } })
  async run(@Body() dto: DeployRunDto, @Req() req: Request & { user: User }) {
    const t0 = Date.now();
    try {
      const { output, durationMs } = await this.deployService.run(
        req,
        dto.deploy_password,
        dto.deploy_header_token,
        req.user?.id,
      );
      return { success: true, output, durationMs };
    } finally {
      const pad = Math.max(0, DEPLOY_MIN_RESPONSE_MS - (Date.now() - t0));
      if (pad > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, pad));
      }
    }
  }
}
