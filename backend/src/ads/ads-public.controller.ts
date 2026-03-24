import { Controller, Get, Header, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AdsService } from './ads.service';
import { ListActiveAdsDto } from './dto/list-active-ads.dto';

@Controller('ads-public')
@Throttle({ public: { limit: 120, ttl: 60000 } })
export class AdsPublicController {
  constructor(private readonly ads: AdsService) {}

  @Get('active')
  @Header('Cache-Control', 'public, max-age=60')
  listActive(@Query() dto: ListActiveAdsDto) {
    return this.ads.listActiveWithMeta(dto);
  }
}
