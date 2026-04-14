import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ButterflyExamService } from './butterfly-exam.service';

/**
 * Veli/öğrenci: kurum kodu + öğrenci numarası ile salon/koltuk (auth yok, rate limit).
 */
@Controller('butterfly-exam-public')
@Throttle({ public: { limit: 60, ttl: 60000 } })
export class ButterflyExamPublicController {
  constructor(private readonly service: ButterflyExamService) {}

  @Get('lookup')
  async lookup(
    @Query('institution_code') institutionCode?: string,
    @Query('student_number') studentNumber?: string,
    @Query('plan_id') planId?: string,
  ) {
    return this.service.publicLookup(institutionCode ?? '', studentNumber ?? '', planId?.trim() || undefined);
  }
}
