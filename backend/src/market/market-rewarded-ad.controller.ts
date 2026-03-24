import { Controller, Get, Req, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { MarketRewardedAdSsvService } from './market-rewarded-ad-ssv.service';

/** AdMob ödüllü reklam SSV — Google’dan GET (auth yok). */
@Controller('market')
export class MarketRewardedAdController {
  constructor(private readonly ssv: MarketRewardedAdSsvService) {}

  @Get('rewarded-ad/ssv')
  @SkipThrottle()
  async rewardedAdSsv(@Req() req: Request, @Res() res: Response) {
    const url = req.originalUrl || req.url || '';
    const q = url.includes('?') ? url.split('?')[1] : '';
    const result = await this.ssv.handleSsvQueryString(q);
    const body = result.status === 'ok' ? 'OK' : result.status === 'ignored' ? 'IGNORE' : 'ERR';
    res.status(200).type('text/plain').send(body);
  }
}
