import { Body, Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { SeedService } from './seed.service';
import { env } from '../config/env';

@Controller('seed')
export class SeedController {
  constructor(private readonly seedService: SeedService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async seed() {
    if (env.nodeEnv !== 'local') {
      const { ForbiddenException } = await import('@nestjs/common');
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    }
    return this.seedService.run();
  }

  /** Sadece akademik takvim şablonunu doldur (work_calendar + seminer sonrası için) */
  @Post('academic-calendar')
  @HttpCode(HttpStatus.OK)
  async seedAcademicCalendar(@Body() body: { academic_year?: string }) {
    if (env.nodeEnv !== 'local') {
      const { ForbiddenException } = await import('@nestjs/common');
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    }
    return this.seedService.seedAcademicCalendarOnly(body.academic_year?.trim() ?? '2025-2026');
  }

  /** BİLSEM takvim şablonunu doldur (2025-2026) */
  @Post('bilsem-calendar')
  @HttpCode(HttpStatus.OK)
  async seedBilsemCalendar(@Body() body: { academic_year?: string }) {
    if (env.nodeEnv !== 'local') {
      const { ForbiddenException } = await import('@nestjs/common');
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    }
    return this.seedService.seedBilsemCalendar(body.academic_year?.trim() ?? '2025-2026');
  }
}
