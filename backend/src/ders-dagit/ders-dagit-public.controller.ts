import { Controller, Get, Param, Query, NotFoundException, Res } from '@nestjs/common';
import type { Response } from 'express';
import { DersDagitService } from './ders-dagit.service';

/** JWT olmadan salt okunur program önizleme (paylaşım linki). */
@Controller('ders-dagit/public')
export class DersDagitPublicController {
  constructor(private readonly service: DersDagitService) {}

  @Get('share/:token')
  async share(@Param('token') token: string, @Query('section') section?: string) {
    const data = await this.service.getProgramByShareToken(token.trim(), section);
    if (!data) throw new NotFoundException();
    return data;
  }

  @Get('share/:token/parent.pdf')
  async shareParentPdf(
    @Param('token') token: string,
    @Query('section') section: string,
    @Res() res: Response,
  ) {
    const pdf = await this.service.exportPublicParentPdf(token.trim(), section);
    res.setHeader('Content-Type', 'application/pdf');
    const sec = (section?.trim() || 'sinif').replace(/[^\w.-]+/g, '_');
    res.setHeader('Content-Disposition', `attachment; filename="program-${sec}.pdf"`);
    res.send(Buffer.from(pdf));
  }
}
