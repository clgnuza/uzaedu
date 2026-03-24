import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { School } from '../schools/entities/school.entity';
import { User } from '../users/entities/user.entity';
import { Announcement } from '../announcements/entities/announcement.entity';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([School, User, Announcement]),
  ],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
