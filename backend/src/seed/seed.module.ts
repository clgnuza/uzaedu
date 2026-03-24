import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { School } from '../schools/entities/school.entity';
import { SiteMapItem } from '../site-map/entities/site-map-item.entity';
import { AcademicCalendarItem } from '../academic-calendar/entities/academic-calendar-item.entity';
import { WorkCalendarModule } from '../work-calendar/work-calendar.module';
import { BilsemModule } from '../bilsem/bilsem.module';
import { SeedController } from './seed.controller';
import { SeedService } from './seed.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, School, SiteMapItem, AcademicCalendarItem]),
    WorkCalendarModule,
    BilsemModule,
  ],
  controllers: [SeedController],
  providers: [SeedService],
})
export class SeedModule {}
