import { Module } from '@nestjs/common';
import { MebFetchService } from './meb-fetch.service';

@Module({
  providers: [MebFetchService],
  exports: [MebFetchService],
})
export class MebModule {}
