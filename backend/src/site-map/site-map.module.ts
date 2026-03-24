import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SiteMapItem } from './entities/site-map-item.entity';
import { School } from '../schools/entities/school.entity';
import { SiteMapService } from './site-map.service';
import { SiteMapController } from './site-map.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SiteMapItem, School])],
  controllers: [SiteMapController],
  providers: [SiteMapService],
  exports: [SiteMapService],
})
export class SiteMapModule {}
