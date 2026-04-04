import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Req,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { randomBytes } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { Request, Response } from 'express';
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

  /** Yalnızca APP_ENV=local|development|test: yerel DB → data-mirror.sql indir */
  @Get('data-mirror-export')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  @Throttle({ default: { limit: 4, ttl: 3_600_000 } })
  async dataMirrorExport(
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    if (!this.deployService.dataMirrorExportAllowed()) {
      throw new ForbiddenException(
        'Yerel SQL dışa aktarma bu ortamda kapalı (yalnızca APP_ENV=local/development/test).',
      );
    }
    const tmp = path.join(
      os.tmpdir(),
      `dm-${Date.now()}-${randomBytes(6).toString('hex')}.sql`,
    );
    try {
      await this.deployService.writeDataMirrorExportFile(tmp);
    } catch (e) {
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
      throw e;
    }
    const stat = fs.statSync(tmp);
    if (!stat.size) {
      fs.unlinkSync(tmp);
      throw new BadRequestException('Export boş üretildi.');
    }
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/sql; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="data-mirror-${date}.sql"`);
    const stream = fs.createReadStream(tmp);
    const cleanup = () => fs.unlink(tmp, () => undefined);
    stream.on('close', cleanup);
    stream.on('error', cleanup);
    return new StreamableFile(stream, { type: 'application/sql' });
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
